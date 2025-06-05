/**
 * Admin routes
 * These routes handle administrative operations with proper authentication checks
 */
import { Request, Response, NextFunction, Express } from "express";
import { storage } from "../storage";
import { sendEmail } from "../services/email";
import { db } from "../db";
import jwt from "jsonwebtoken";
import { 
  users, reviews, checkIns, eventRsvps, groupMembers, 
  posts, postLikes, comments, connections, messages,
  groups, groupEvents, groupEventRsvps
} from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";

// Secret key for JWT signing - must match what's used in auth.ts
const AUTH_TOKEN_KEY = process.env.AUTH_TOKEN_KEY || "your_secure_sportyuk_token_key";

// Protected user IDs that cannot be deleted
const PROTECTED_USER_IDS = [3]; // Arthur's user ID

// Admin user ID for Arthur from database
const ADMIN_USER_ID = 3; // Arthur's user ID (confirmed from database)

// Middleware to check if the user is an admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  // Debug request headers
  console.log("isAdmin middleware: Request headers:", req.headers);
  console.log("isAdmin middleware: Request cookies:", req.cookies);
  
  // Check if user is set (which would have been done by the requireAuth middleware)
  if (!req.user) {
    console.log("isAdmin middleware: No user found in request");
    return res.status(401).json({ message: "Authentication required" });
  }

  console.log(`isAdmin middleware: Checking if user ${req.user.username} (ID: ${req.user.id}) is admin`);
  
  // Check for isAdmin flag in user object or ID 3 (Arthur)
  if (req.user.isAdmin !== true && req.user.id !== ADMIN_USER_ID) {
    console.log(`isAdmin middleware: User ${req.user.username} (ID: ${req.user.id}) is not admin`);
    
    // If it's Arthur (ID 3), update the isAdmin flag automatically
    if (req.user.id === ADMIN_USER_ID) {
      console.log(`Setting isAdmin=true for Arthur (ID: ${ADMIN_USER_ID})`);
      // Set isAdmin in the current request
      req.user.isAdmin = true;
    } else {
      return res.status(403).json({ message: "Admin privileges required" });
    }
  }

  console.log(`isAdmin middleware: User ${req.user.username} (ID: ${req.user.id}) confirmed as admin`);
  next();
}

export function registerAdminRoutes(app: Express, requireAuth: any) {
  // Get all users (admin only)
  app.get("/api/admin/users", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const usersList = await db.select().from(users);
      console.log(`Found ${usersList.length} users matching all`);
      return res.json(usersList);
    } catch (error) {
      console.error("Error fetching users for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch users",
      });
    }
  });
  
  // Get all posts (admin only)
  app.get("/api/admin/posts", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      console.log("Admin fetching all posts");
      
      // Get all posts with user details - no filtering by visibility
      const allPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          createdAt: posts.createdAt,
          imageUrl: posts.imageUrl,
          likes: posts.likes,
          sportType: posts.sportType,
          userId: posts.userId,
          isPublic: posts.isPublic,
          username: users.username,
          fullName: users.fullName,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .orderBy(desc(posts.createdAt));
      
      console.log(`Found ${allPosts.length} posts for admin viewing`);
      res.json(allPosts);
    } catch (error) {
      console.error("Error fetching posts for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch posts",
      });
    }
  });
  
  // Delete user (admin only)
  app.delete("/api/admin/users/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      console.log(`Admin attempting to delete user ${userId}`);
      
      // Validate user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`User with ID ${userId} not found for deletion`);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if trying to delete a protected user or an admin user
      if (PROTECTED_USER_IDS.includes(userId) || user.isAdmin === true) {
        console.log(`Preventing deletion of protected/admin user ${userId} (${user.username})`);
        return res.status(403).json({ message: "Cannot delete protected or admin users" });
      }
      
      console.log(`Found user to delete: ${user.username} (ID: ${userId})`);
      
      // Start transaction to delete all user-related data
      await db.transaction(async (tx) => {
        // Delete user's reviews
        await tx.delete(reviews).where(eq(reviews.userId, userId));
        
        // Delete user's check-ins
        await tx.delete(checkIns).where(eq(checkIns.userId, userId));
        
        // Delete user's event RSVPs
        await tx.delete(eventRsvps).where(eq(eventRsvps.userId, userId));
        
        // Delete user's group event RSVPs
        await tx.delete(groupEventRsvps).where(eq(groupEventRsvps.userId, userId));
        
        // Delete user's group memberships
        await tx.delete(groupMembers).where(eq(groupMembers.userId, userId));
        
        // Delete user's post likes
        await tx.delete(postLikes).where(eq(postLikes.userId, userId));
        
        // Delete user's comments
        await tx.delete(comments).where(eq(comments.userId, userId));
        
        // Delete user's posts
        await tx.delete(posts).where(eq(posts.userId, userId));
        
        // Delete user's connections (where user is either the requester or recipient)
        await tx.delete(connections).where(
          or(
            eq(connections.userId, userId),
            eq(connections.connectedUserId, userId)
          )
        );
        
        // Delete user's messages (where user is either the sender or receiver)
        await tx.delete(messages).where(
          or(
            eq(messages.senderId, userId),
            eq(messages.receiverId, userId)
          )
        );
        
        // Finally, delete the user
        await tx.delete(users).where(eq(users.id, userId));
      });
      
      console.log(`Successfully deleted user ${userId} and all related data`);
      res.json({ 
        message: "User and all related data deleted successfully", 
        userId: userId 
      });
    } catch (error) {
      console.error("Error deleting user for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete user",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  
  // Edit public post (admin only)
  app.put("/api/admin/posts/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.id);
      const { content } = req.body;
      
      console.log(`Admin attempting to edit post ${postId}`);
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: "Content is required and must be a string" });
      }
      
      // Find the post
      const [post] = await db.select().from(posts).where(eq(posts.id, postId));
      
      if (!post) {
        console.log(`Post with ID ${postId} not found`);
        return res.status(404).json({ message: "Post not found" });
      }
      
      console.log(`Found post to edit:`, post);
      
      // Update the post content
      const [updatedPost] = await db
        .update(posts)
        .set({ 
          content,
          updatedAt: new Date()
        })
        .where(eq(posts.id, postId))
        .returning();
      
      console.log(`Successfully updated post ${postId}`);
      res.json(updatedPost);
    } catch (error) {
      console.error("Error updating post for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update post",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  
  // Delete public post (admin only)
  app.delete("/api/admin/posts/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.id);
      
      console.log(`Admin attempting to delete post ${postId}`);
      
      // Find the post
      const [post] = await db.select().from(posts).where(eq(posts.id, postId));
      
      if (!post) {
        console.log(`Post with ID ${postId} not found`);
        return res.status(404).json({ message: "Post not found" });
      }
      
      console.log(`Found post to delete:`, post);
      
      // Delete post likes first
      await db.delete(postLikes).where(eq(postLikes.postId, postId));
      
      // Delete post comments
      await db.delete(comments).where(eq(comments.postId, postId));
      
      // Delete the post
      await db.delete(posts).where(eq(posts.id, postId));
      
      console.log(`Successfully deleted post ${postId}`);
      res.json({ 
        message: "Post deleted successfully", 
        postId: postId 
      });
    } catch (error) {
      console.error("Error deleting post for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete post",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  // Debug endpoint to check if the admin routes are registered
  // Skip admin check but still require authentication to get user data
  app.get("/api/admin/debug", requireAuth, (req: Request, res: Response) => {
    console.log("Admin debug endpoint accessed");
    console.log("Request headers:", {
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'authorization': req.headers.authorization ? 'Present' : 'None',
      'cookie': req.headers.cookie ? 'Present' : 'None'
    });
    console.log("Request cookies:", req.cookies);
    
    // Try to get token from various sources
    let token = req.cookies.auth_token;
    
    // If no token in cookies, try Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log("Using token from Authorization header");
      }
    }
    
    const hasToken = !!token;
    const userId = req.user?.id;
    
    // Check if the request is from Arthur (special admin user)
    const isArthur = userId === ADMIN_USER_ID || 
                     req.user?.username === "Arthur" || 
                     (token && token.includes('"username":"Arthur"'));
    
    // Extract admin status
    const isAdmin = req.user?.isAdmin === true || isArthur;
    
    // Create response object
    const response = {
      message: "Admin routes debug endpoint",
      hasAuthToken: hasToken,
      tokenSource: token ? 
                   (req.cookies.auth_token ? "cookie" : "authorization_header") : 
                   "none",
      isAdmin: isAdmin,
      isArthur: isArthur,
      userId: userId,
      user: req.user ? {
        id: req.user.id,
        username: req.user.username,
        isAdmin: req.user.isAdmin || isArthur
      } : null,
      adminUserId: ADMIN_USER_ID,
      timestamp: new Date().toISOString()
    };
    
    // Set an admin flag in the session if this is Arthur
    if (isArthur && req.user && !req.user.isAdmin) {
      console.log(`Updating isAdmin=true for Arthur (ID: ${ADMIN_USER_ID})`);
      req.user.isAdmin = true;
    }
    
    console.log("Admin debug response:", response);
    res.json(response);
  });
  
  // Toggle user admin status (admin only)
  app.post("/api/admin/users/:id/toggle-admin", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      console.log(`Admin attempting to toggle admin status for user ${userId}`);
      
      // Validate user exists
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`User with ID ${userId} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent removing admin status from Arthur (ID 3), even by Arthur himself
      if (userId === ADMIN_USER_ID && !!user.isAdmin === true) {
        console.log(`Preventing removal of admin status from Arthur (ID: ${ADMIN_USER_ID})`);
        return res.status(403).json({ message: "Cannot remove admin status from super admin" });
      }
      
      // Prevent Arthur from trying to remove his own admin status
      if (userId === ADMIN_USER_ID && req.user?.id === ADMIN_USER_ID) {
        console.log(`Preventing Arthur (ID: ${ADMIN_USER_ID}) from removing his own admin status`);
        return res.status(403).json({ message: "Super admin cannot remove their own admin status" });
      }
      
      // Toggle the admin status - convert to boolean first to handle null/undefined cases
      const currentAdminStatus = !!user.isAdmin;
      const newAdminStatus = !currentAdminStatus;
      
      console.log(`Changing admin status for user ${user.username} (ID: ${userId}) from ${currentAdminStatus} to ${newAdminStatus}`);
      
      // Update directly in database for better SQL control
      try {
        console.log(`Executing SQL update: UPDATE users SET isAdmin = ${newAdminStatus} WHERE id = ${userId}`);
        
        // Use the 'isAdmin' property as defined in the schema 
        // Debug: Print the schema property name
        console.log("Schema property for admin:", users.isAdmin.name);
        
        const [updatedUser] = await db
          .update(users)
          .set({ 
            isAdmin: newAdminStatus  // Use the property name from the schema
          })
          .where(eq(users.id, userId))
          .returning();
        
        console.log(`Successfully updated admin status in database for user ${updatedUser.username} (ID: ${userId}) to ${updatedUser.isAdmin}`);
        
        // Get the full user object without sensitive data for token refresh
        const { password, ...userWithoutPassword } = updatedUser;
        
        // Create a new refresh token with updated user data
        const refreshToken = jwt.sign(userWithoutPassword, AUTH_TOKEN_KEY, {
          expiresIn: "7d",
        });
        
        // If this is not the current user (admin toggling another user), notify them
        if (req.user && req.user.id !== userId) {
          try {
            // Send email notification about admin status change if email is available
            if (updatedUser.email) {
              // Get SendGrid API key from environment
              const sendgridApiKey = process.env.SENDGRID_API_KEY;
              
              await sendEmail(
                sendgridApiKey,
                {
                  to: updatedUser.email,
                  from: "noreply@yukhala.com", // Add the required from field
                  subject: `Your admin status has been ${newAdminStatus ? 'granted' : 'revoked'}`,
                  text: `Dear ${updatedUser.fullName || updatedUser.username},

Your admin privileges for the YukHaLa app have been ${newAdminStatus ? 'granted' : 'revoked'} by an administrator.

Please log out and log back in for this change to take effect.

Regards,
YukHaLa Team`,
                  html: `<p>Dear ${updatedUser.fullName || updatedUser.username},</p>
<p>Your admin privileges for the YukHaLa app have been <strong>${newAdminStatus ? 'granted' : 'revoked'}</strong> by an administrator.</p>
<p>Please log out and log back in for this change to take effect.</p>
<p>Regards,<br>YukHaLa Team</p>`
                }
              );
              console.log(`Email notification sent to ${updatedUser.email} about admin status change`);
            }
          } catch (emailError) {
            console.error('Failed to send admin status change notification email:', emailError);
            // Continue execution, email notification is not critical
          }
        }
        
        // Make 100% sure we have the latest admin status from the database
        const freshUserData = await db.select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        
        const freshUserStatus = freshUserData.length > 0 ? freshUserData[0].isAdmin : updatedUser.isAdmin;
        
        console.log(`Fresh user data for ${updatedUser.username} (ID: ${userId}): isAdmin=${freshUserStatus}`);
        
        res.json({
          message: `User admin status toggled to ${freshUserStatus}`,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            isAdmin: freshUserStatus
          },
          // Include a refresh token that can be used to update the user's session
          refreshToken,
          needsLogout: req.user && req.user.id !== userId
        });
      } catch (dbError) {
        console.error(`Database error updating admin status for user ${userId}:`, dbError);
        return res.status(500).json({ 
          message: "Database error updating admin status",
          details: dbError instanceof Error ? dbError.message : undefined
        });
      }
    } catch (error) {
      console.error("Error toggling admin status:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to toggle admin status",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  // Test endpoint for admin toggle
  app.get("/api/admin/test-toggle", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      // Get the schema name of isAdmin property
      const adminPropertyName = users.isAdmin.name;
      
      res.json({
        message: "Admin toggle test endpoint",
        schemaProperty: {
          name: adminPropertyName,
          // If this is 'is_admin', our fix may not be working correctly
          // If this is 'isAdmin', our fix should work
          expectedToMatch: adminPropertyName === 'isAdmin'
        }
      });
    } catch (error) {
      console.error("Error in test-toggle endpoint:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Error in test endpoint"
      });
    }
  });
  
  // Get all groups (admin only)
  app.get("/api/admin/groups", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      console.log("[admin-routes] Getting groups for admin");
      const groups = await storage.getGroups();
      console.log(`[admin-routes] Found ${groups.length} groups`);
      
      // Add missing memberCount property to each group
      const groupsWithMemberCount = await Promise.all(groups.map(async (group) => {
        const members = await storage.getGroupMembers(group.id);
        return {
          ...group,
          memberCount: members.length
        };
      }));
      
      res.json(groupsWithMemberCount);
    } catch (error) {
      console.error("Error fetching groups for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch groups",
      });
    }
  });
  
  // Get all events (admin only)
  app.get("/api/admin/events", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to fetch events",
      });
    }
  });
  
  // Update a facility (admin only)
  app.put("/api/admin/facilities/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const facilityId = parseInt(req.params.id);
      const facilityData = req.body;
      
      console.log(`Admin attempting to update facility ${facilityId} with data:`, JSON.stringify(facilityData));
      
      // Validate that facility exists
      const existingFacility = await storage.getFacility(facilityId);
      if (!existingFacility) {
        console.log(`Facility with ID ${facilityId} not found`);
        return res.status(404).json({ message: "Facility not found" });
      }
      
      console.log(`Found existing facility:`, JSON.stringify(existingFacility));
      
      // Create a simplified and safe copy of facility data to update
      // This avoids any issues with complex objects or types
      const updateData: Record<string, any> = {
        name: facilityData.name,
        description: facilityData.description,
        type: facilityData.sportType || facilityData.type,
        address: facilityData.address,
        district: facilityData.district,
        latitude: typeof facilityData.latitude === 'number' ? facilityData.latitude : parseFloat(facilityData.latitude),
        longitude: typeof facilityData.longitude === 'number' ? facilityData.longitude : parseFloat(facilityData.longitude),
        openTime: facilityData.openTime,
        closeTime: facilityData.closeTime,
        website: facilityData.website,
        imageUrl: facilityData.imageUrl
      };
      
      // Remove any undefined or null values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      console.log(`Simplified facility data for update:`, JSON.stringify(updateData));
      
      // Update the facility with processed data
      const updatedFacility = await storage.updateFacility(facilityId, updateData);
      if (!updatedFacility) {
        console.log(`Update failed for facility ${facilityId}`);
        return res.status(404).json({ message: "Facility not found or update failed" });
      }
      
      console.log(`Successfully updated facility ${facilityId}`);
      res.json(updatedFacility);
    } catch (error) {
      console.error("Error updating facility for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update facility",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  
  // Update an event (admin only)
  app.put("/api/admin/events/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const eventData = req.body;
      
      console.log(`Admin attempting to update event ${eventId} with data:`, eventData);
      
      // Validate that event exists
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        console.log(`Event with ID ${eventId} not found`);
        return res.status(404).json({ message: "Event not found" });
      }
      
      console.log(`Found existing event:`, existingEvent);
      
      // Process the data, handling date fields specially
      const processedData: Record<string, any> = {};
      
      // Fields that should never be changed
      const protectedFields = ['id', 'createdAt', 'updatedAt'];
      
      for (const [key, value] of Object.entries(eventData)) {
        // Skip null/undefined values or protected fields
        if (value === null || value === undefined || protectedFields.includes(key)) {
          continue;
        }
        
        // Special check for date field - ensure it's a proper Date
        if (key === 'date' || key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
          if (typeof value === 'string') {
            try {
              const parsedDate = new Date(value);
              if (!isNaN(parsedDate.getTime())) {
                processedData[key] = parsedDate;
              } else {
                console.log(`Invalid date value for ${key}: ${value}, skipping`);
              }
            } catch (e) {
              console.log(`Error parsing date for ${key}: ${value}, skipping`, e);
            }
          } else if (value instanceof Date) {
            processedData[key] = value;
          }
        } else {
          // For non-date fields, use as-is
          processedData[key] = value;
        }
      }
      
      console.log(`Processed event data for update:`, processedData);
      
      // Update the event with processed data
      const updatedEvent = await storage.updateEvent(eventId, processedData);
      if (!updatedEvent) {
        console.log(`Update failed for event ${eventId}`);
        return res.status(404).json({ message: "Event not found or update failed" });
      }
      
      console.log(`Successfully updated event ${eventId}:`, updatedEvent);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to update event",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });
  
  // Delete an event (admin only)
  app.delete("/api/admin/events/:id", requireAuth, isAdmin, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      
      console.log(`Admin attempting to delete event ${eventId}`);
      
      // Validate that event exists
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        console.log(`Event with ID ${eventId} not found for deletion`);
        return res.status(404).json({ message: "Event not found" });
      }
      
      console.log(`Found event to delete:`, existingEvent);
      
      // Delete the event
      await storage.deleteEvent(eventId);
      
      console.log(`Successfully deleted event ${eventId}`);
      res.json({ message: "Event deleted successfully", id: eventId });
    } catch (error) {
      console.error("Error deleting event for admin:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to delete event",
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  // Get group members (admin only)
  app.get(
    "/api/admin/groups/:groupId/members",
    requireAuth,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const members = await storage.getGroupMembers(groupId);
        res.json(members);
      } catch (error) {
        console.error("Error fetching group members for admin:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch group members",
        });
      }
    }
  );

  // Delete group (admin only)
  app.delete(
    "/api/admin/groups/:groupId",
    requireAuth,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        
        console.log(`Admin attempting to delete group ${groupId}`);
        
        // Get group info and members before deletion for notifications
        const group = await storage.getGroup(groupId);
        if (!group) {
          console.log(`Group with ID ${groupId} not found for deletion`);
          return res.status(404).json({ message: "Group not found" });
        }
        
        console.log(`Found group to delete:`, group);
        
        const members = await storage.getGroupMembers(groupId);
        console.log(`Group has ${members.length} members who will be notified:`, 
          members.map(m => `${m.username} (${m.email || 'no email'})`));
        
        // Delete the group (with additional error handling)
        try {
          await storage.deleteGroup(groupId);
          console.log(`Group ${groupId} successfully deleted from database`);
        } catch (deleteError) {
          console.error(`Database error while deleting group ${groupId}:`, deleteError);
          throw deleteError; // Re-throw to be caught by the outer try/catch
        }
        
        // Only send notifications if email API key is available
        if (!process.env.SENDGRID_API_KEY) {
          console.log('SendGrid API key not available, skipping email notifications');
          return res.json({ 
            message: "Group deleted successfully, no notifications sent (email API key missing)", 
            groupId 
          });
        }
        
        // Send notifications to all members
        console.log(`Attempting to send notifications to ${members.length} members`);
        const notifications = members.map(async (member) => {
          if (member.email) {
            try {
              // Send email notification
              await sendEmail(process.env.SENDGRID_API_KEY!, {
                to: member.email,
                from: "noreply@sportsmatch.com",
                subject: `Group "${group.name}" has been deleted`,
                text: `Hello ${member.username},\n\nWe're writing to inform you that the group "${group.name}" has been deleted by an administrator. If you have any questions, please contact our support team.\n\nThank you,\nThe SportsMatch Team`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                    <h2>Group Deleted</h2>
                    <p>Hello ${member.username},</p>
                    <p>We're writing to inform you that the group <strong>"${group.name}"</strong> has been deleted by an administrator.</p>
                    <p>If you have any questions, please contact our support team.</p>
                    <p>Thank you,<br>The SportsMatch Team</p>
                  </div>
                `,
              });
              console.log(`Notification email sent to ${member.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${member.email}:`, emailError);
            }
          } else {
            console.log(`No email available for member ${member.username}, skipping notification`);
          }
        });
        
        // Wait for all notifications to be sent or attempted
        await Promise.allSettled(notifications);
        console.log(`All notification attempts completed for group ${groupId}`);
        
        res.json({ message: "Group deleted successfully", groupId });
      } catch (error) {
        console.error("Error deleting group for admin:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to delete group",
          details: error instanceof Error ? error.message : undefined
        });
      }
    }
  );

  // Send notification to user (admin only)
  app.post(
    "/api/admin/notify",
    requireAuth,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId, groupId, message } = req.body;
        
        if (!userId || !message) {
          return res.status(400).json({ message: "User ID and message are required" });
        }
        
        // Get user and group info
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        let groupName = "the group";
        if (groupId) {
          const group = await storage.getGroup(groupId);
          if (group) {
            groupName = group.name;
          }
        }
        
        // Check if user has an email
        if (!user.email) {
          return res.status(400).json({ message: "User does not have an email address" });
        }
        
        // Send email notification
        await sendEmail(process.env.SENDGRID_API_KEY, {
          to: user.email,
          from: "noreply@sportsmatch.com",
          subject: `Important notification about ${groupName}`,
          text: `Hello ${user.username},\n\n${message}\n\nThank you,\nThe SportsMatch Team`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2>Important Notification</h2>
              <p>Hello ${user.username},</p>
              <p>${message}</p>
              <p>Thank you,<br>The SportsMatch Team</p>
            </div>
          `,
        });
        
        res.json({ message: "Notification sent successfully" });
      } catch (error) {
        console.error("Error sending notification for admin:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to send notification",
        });
      }
    }
  );
}