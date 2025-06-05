import { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, like, desc, and, sql, count, asc, inArray, or, ilike } from "drizzle-orm";
import { db } from "../db";
import {
  groups,
  groupMembers,
  posts,
  comments,
  connections,
  users,
  postLikes,
  insertGroupSchema,
  insertGroupMemberSchema,
  insertPostSchema,
  insertCommentSchema,
  insertConnectionSchema,
  insertPostLikeSchema,
  connectionStatuses,
} from "@shared/schema";

export function registerCommunityRoutes(app: Express, requireAuth: any) {
  // ================ GROUPS ROUTES ================
  
  // Get the groups that the current user is a member of
  app.get("/api/groups/my-groups", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("User set in requireAuth:", req.user?.username, "(ID:", req.user?.id, ")");
      const userId = req.user!.id;
      
      // Use prepared select statement for better type safety and to avoid SQL injection
      const myGroups = await db
        .select({
          id: groups.id,
          name: groups.name,
          description: groups.description,
          creatorId: groups.creatorId,
          createdAt: groups.createdAt,
          sportType: groups.sportType,
          district: groups.district,
          imageUrl: groups.imageUrl,
          isPrivate: groups.isPrivate,
        })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, "approved")
        ))
        .orderBy(desc(groups.createdAt));

      console.log(`Found ${myGroups.length} groups for user ${userId}`);

      if (myGroups.length === 0) {
        console.log("No groups found for user:", userId);
        return res.json([]);
      }
      
      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        myGroups.map(async (group) => {
          const memberCountResult = await db
            .select({ count: count() })
            .from(groupMembers)
            .where(and(
              eq(groupMembers.groupId, group.id),
              eq(groupMembers.status, "approved")
            ));
          
          const memberCount = memberCountResult[0]?.count || 0;
          
          return {
            ...group,
            memberCount: Number(memberCount)
          };
        })
      );
      
      return res.json(groupsWithCounts);
    } catch (error) {
      console.error("Error fetching user's groups:", error);
      next(error);
    }
  });

  // Get all groups with optional filtering
  app.get("/api/groups", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as string | undefined;
      const query = req.query.query as string | undefined;

      // Build query conditions
      const queryConditions = [];
      
      if (type) {
        queryConditions.push(eq(groups.sportType, type));
      }
      
      if (query) {
        queryConditions.push(
          sql`(${groups.name} ILIKE ${`%${query}%`} OR ${groups.description} ILIKE ${`%${query}%`})`
        );
      }

      // Get all groups with basic information
      console.log("Fetching groups with conditions:", queryConditions);
      
      const result = queryConditions.length > 0
        ? await db
            .select()
            .from(groups)
            .where(and(...queryConditions))
            .orderBy(desc(groups.createdAt))
        : await db
            .select()
            .from(groups)
            .orderBy(desc(groups.createdAt));
            
      // For each group, calculate the actual member count
      const groupsWithMemberCount = await Promise.all(result.map(async group => {
        // Count members for this group (only approved members, not pending)
        const memberCountResult = await db
          .select({ count: count() })
          .from(groupMembers)
          .where(and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.status, "approved")
          ));
        
        const memberCount = memberCountResult[0]?.count || 0;
        
        return {
          ...group,
          memberCount: Number(memberCount)
        };
      }));
      
      console.log("Found groups with member counts:", groupsWithMemberCount);
      return res.json(groupsWithMemberCount);
    } catch (error) {
      console.error("Error fetching groups:", error);
      next(error);
    }
  });

  // Get a specific group by ID with member count
  app.get("/api/groups/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Get group details
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get member count (only approved members)
      const [{ count: memberCount }] = await db
        .select({ 
          count: count() 
        })
        .from(groupMembers)
        .where(and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.status, "approved")
        ));

      // Return with accurate member count
      return res.json({
        ...group,
        memberCount: Number(memberCount),
      });
    } catch (error) {
      console.error("Error fetching group:", error);
      next(error);
    }
  });

  // Create a new group
  app.post("/api/groups", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const groupData = insertGroupSchema.parse({
        ...req.body,
        creatorId: userId,
      });

      // Create group
      const [newGroup] = await db
        .insert(groups)
        .values(groupData)
        .returning();

      if (!newGroup) {
        return res.status(500).json({ message: "Failed to create group" });
      }

      // Add creator as admin member with approved status
      const [groupMember] = await db
        .insert(groupMembers)
        .values({
          groupId: newGroup.id,
          userId: userId,
          role: "admin",
          joinedAt: new Date(),
          status: "approved", // Explicitly set status to approved
        })
        .returning();

      // Return the created group
      return res.status(201).json({
        ...newGroup,
        memberCount: 1,
      });
    } catch (error) {
      console.error("Error creating group:", error);
      next(error);
    }
  });

  // Get members of a group
  app.get("/api/groups/:id/members", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      const statusFilter = req.query.status as string | undefined;
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Start building the query
      let query = db
        .select({
          groupId: groupMembers.groupId,
          userId: groupMembers.userId,
          role: groupMembers.role,
          joinedAt: groupMembers.joinedAt,
          status: groupMembers.status,
          username: users.username,
          fullName: users.fullName,
        })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(eq(groupMembers.groupId, groupId));
      
      // Add status filter if provided
      if (statusFilter) {
        query = query.where(eq(groupMembers.status, statusFilter));
      }

      const members = await query;
      return res.json(members);
    } catch (error) {
      console.error("Error fetching group members:", error);
      next(error);
    }
  });

  // Join a group
  app.post("/api/groups/:id/join", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if group exists
      const [group] = await db
        .select()
        .from(groups)
        .where(eq(groups.id, groupId));
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if user is already a member or has a pending request
      const [existingMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      if (existingMember) {
        if (existingMember.status === "pending") {
          return res.status(400).json({ message: "Join request already pending approval" });
        } else if (existingMember.status === "approved") {
          return res.status(400).json({ message: "Already a member of this group" });
        } else if (existingMember.status === "rejected") {
          return res.status(400).json({ message: "Your request to join this group was previously declined" });
        }
      }

      // Check if the group is private
      const memberStatus = group.isPrivate ? "pending" : "approved";
      
      // Add user as a member with appropriate status
      const memberData = {
        groupId,
        userId,
        role: "member" as const,
        joinedAt: new Date(),
        status: memberStatus,
      };

      const [newMember] = await db
        .insert(groupMembers)
        .values(memberData)
        .returning();

      // Return appropriate message based on group privacy
      if (group.isPrivate) {
        return res.status(201).json({
          ...newMember,
          message: "Your request to join this group is pending approval from an admin"
        });
      } else {
        return res.status(201).json({
          ...newMember,
          message: "Successfully joined the group"
        });
      }
    } catch (error) {
      console.error("Error joining group:", error);
      next(error);
    }
  });

  // Approve or reject a group membership request
  app.post("/api/groups/:groupId/members/:userId/status", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const memberUserId = parseInt(req.params.userId);
      const adminUserId = req.user!.id;
      const { status } = req.body;
      
      if (isNaN(groupId) || isNaN(memberUserId)) {
        return res.status(400).json({ message: "Invalid group ID or user ID" });
      }
      
      if (!status || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'approved' or 'rejected'" });
      }

      // Check if admin is a member of the group with admin role
      const [adminMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, adminUserId),
            eq(groupMembers.role, "admin")
          )
        );
      
      if (!adminMember) {
        return res.status(403).json({ message: "Only group admins can approve or reject membership requests" });
      }

      // Check if the user has a pending request
      const [pendingMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, memberUserId),
            eq(groupMembers.status, "pending")
          )
        );
      
      if (!pendingMember) {
        return res.status(404).json({ message: "No pending membership request found for this user" });
      }

      // Update the membership status
      await db
        .update(groupMembers)
        .set({ status })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, memberUserId)
          )
        );
      
      // Get user info for response
      const [user] = await db
        .select({
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(eq(users.id, memberUserId));

      return res.status(200).json({
        message: `Membership request ${status === "approved" ? "approved" : "rejected"}`,
        user: user,
        status: status
      });
    } catch (error) {
      console.error("Error processing membership request:", error);
      next(error);
    }
  });

  // Get pending membership requests for a group
  app.get("/api/groups/:id/requests", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if user is an admin of the group
      const [adminMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId),
            eq(groupMembers.role, "admin")
          )
        );
      
      if (!adminMember) {
        return res.status(403).json({ message: "Only group admins can view membership requests" });
      }

      // Get all pending membership requests with user details
      const pendingRequests = await db
        .select({
          userId: groupMembers.userId,
          groupId: groupMembers.groupId,
          joinedAt: groupMembers.joinedAt,
          username: users.username,
          fullName: users.fullName,
        })
        .from(groupMembers)
        .innerJoin(users, eq(groupMembers.userId, users.id))
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.status, "pending")
          )
        );

      return res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending membership requests:", error);
      next(error);
    }
  });

  // Leave a group
  app.post("/api/groups/:id/leave", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if user is a member
      const [existingMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      if (!existingMember) {
        return res.status(400).json({ message: "Not a member of this group" });
      }

      // Check if user is the only admin
      if (existingMember.role === "admin") {
        const [{ count: adminCount }] = await db
          .select({ 
            count: count() 
          })
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.groupId, groupId),
              eq(groupMembers.role, "admin")
            )
          );
        
        if (adminCount === 1) {
          return res.status(400).json({ 
            message: "Cannot leave group: you are the only admin. Please assign another admin first or delete the group." 
          });
        }
      }

      // Remove user from group
      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );

      return res.status(200).json({ message: "Successfully left the group" });
    } catch (error) {
      console.error("Error leaving group:", error);
      next(error);
    }
  });

  // Get posts for a group
  app.get("/api/groups/:id/posts", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Get all posts with user details
      const groupPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          createdAt: posts.createdAt,
          imageUrl: posts.imageUrl,
          likes: posts.likes,
          userId: posts.userId,
          username: users.username,
          fullName: users.fullName,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(eq(posts.groupId, groupId))
        .orderBy(desc(posts.createdAt));

      return res.json(groupPosts);
    } catch (error) {
      console.error("Error fetching group posts:", error);
      next(error);
    }
  });

  // Create a post in a group
  app.post("/api/groups/:id/posts", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const groupId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(groupId)) {
        return res.status(400).json({ message: "Invalid group ID" });
      }

      // Check if user is a member
      const [existingMember] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        );
      
      if (!existingMember) {
        return res.status(403).json({ message: "You must be a member to post in this group" });
      }

      // Validate request body
      const postData = insertPostSchema.parse({
        ...req.body,
        userId,
        groupId,
      });

      // Create post
      const [newPost] = await db
        .insert(posts)
        .values(postData)
        .returning();

      // Get user info for response
      const [user] = await db
        .select({
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(eq(users.id, userId));

      // Return post with user details
      return res.status(201).json({
        ...newPost,
        username: user.username,
        fullName: user.fullName,
      });
    } catch (error) {
      console.error("Error creating group post:", error);
      next(error);
    }
  });

  // ================ POST INTERACTION ROUTES ================

  // Like a post
  app.post("/api/posts/:id/like", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check if post exists
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check if user already liked the post
      const [existingLike] = await db
        .select()
        .from(postLikes)
        .where(
          and(
            eq(postLikes.postId, postId),
            eq(postLikes.userId, userId)
          )
        );
      
      if (existingLike) {
        // If already liked, unlike the post
        await db
          .delete(postLikes)
          .where(
            and(
              eq(postLikes.postId, postId),
              eq(postLikes.userId, userId)
            )
          );
        
        // Update post likes count
        await db
          .update(posts)
          .set({ 
            likes: sql`${posts.likes} - 1` 
          })
          .where(eq(posts.id, postId));
        
        return res.json({ 
          message: "Post unliked successfully",
          liked: false
        });
      } else {
        // If not liked, like the post
        await db
          .insert(postLikes)
          .values({
            postId,
            userId,
            createdAt: new Date()
          });
        
        // Update post likes count
        await db
          .update(posts)
          .set({ 
            likes: sql`${posts.likes} + 1` 
          })
          .where(eq(posts.id, postId));
        
        return res.json({ 
          message: "Post liked successfully",
          liked: true
        });
      }
    } catch (error) {
      console.error("Error liking/unliking post:", error);
      next(error);
    }
  });

  // Comment on a post
  app.post("/api/posts/:id/comments", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check if post exists
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Validate and extract comment content
      const { content } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ message: "Comment content is required" });
      }

      // Create comment
      const [newComment] = await db
        .insert(comments)
        .values({
          content,
          userId,
          postId,
          createdAt: new Date()
        })
        .returning();

      // Get user info for response
      const [user] = await db
        .select({
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(eq(users.id, userId));

      // Return comment with user details
      return res.status(201).json({
        ...newComment,
        username: user.username,
        fullName: user.fullName,
      });
    } catch (error) {
      console.error("Error creating comment:", error);
      next(error);
    }
  });

  // Get comments for a post
  app.get("/api/posts/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const postId = parseInt(req.params.id);
      
      if (isNaN(postId)) {
        return res.status(400).json({ message: "Invalid post ID" });
      }

      // Check if post exists
      const [post] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Get comments with user details
      const postComments = await db
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          userId: comments.userId,
          postId: comments.postId,
          username: users.username,
          fullName: users.fullName,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.postId, postId))
        .orderBy(asc(comments.createdAt));

      return res.json(postComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      next(error);
    }
  });

  // ================ CONNECTIONS ROUTES ================

  // Get all connections for current user
  app.get("/api/connections", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Get all user connections
      const userConnections = await db
        .select({
          userId: connections.userId,
          connectedUserId: connections.connectedUserId,
          status: connections.status,
          createdAt: connections.createdAt,
          updatedAt: connections.updatedAt,
          username: users.username,
          fullName: users.fullName,
        })
        .from(connections)
        .innerJoin(users, eq(connections.connectedUserId, users.id))
        .where(eq(connections.userId, userId));

      // Get connections where user is the recipient
      const otherConnections = await db
        .select({
          userId: connections.connectedUserId, // reversed for consistent response format
          connectedUserId: connections.userId, // reversed for consistent response format
          status: connections.status,
          createdAt: connections.createdAt,
          updatedAt: connections.updatedAt,
          username: users.username,
          fullName: users.fullName,
        })
        .from(connections)
        .innerJoin(users, eq(connections.userId, users.id))
        .where(eq(connections.connectedUserId, userId));

      // Combine both sets of connections
      const allConnections = [...userConnections, ...otherConnections];

      return res.json(allConnections.map(conn => ({
        ...conn,
        connectionId: `${conn.userId}-${conn.connectedUserId}` // Create a virtual connection ID
      })));
    } catch (error) {
      console.error("Error fetching connections:", error);
      next(error);
    }
  });

  // Get pending connection requests
  app.get("/api/connections/pending", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      // Get pending connections where user is the recipient
      const pendingRequests = await db
        .select({
          userId: connections.userId,
          connectedUserId: connections.connectedUserId,
          status: connections.status,
          createdAt: connections.createdAt,
          username: users.username,
          fullName: users.fullName,
        })
        .from(connections)
        .innerJoin(users, eq(connections.userId, users.id))
        .where(
          and(
            eq(connections.connectedUserId, userId),
            eq(connections.status, "pending")
          )
        );

      // Add a virtual connection ID
      const pendingWithIds = pendingRequests.map(req => ({
        ...req,
        connectionId: `${req.userId}-${req.connectedUserId}`
      }));

      return res.json(pendingWithIds);
    } catch (error) {
      console.error("Error fetching pending connection requests:", error);
      next(error);
    }
  });

  // Create a connection request
  app.post("/api/connections", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { connectedUserId } = req.body;
      
      if (!connectedUserId || typeof connectedUserId !== 'number') {
        return res.status(400).json({ message: "Valid connected user ID is required" });
      }

      // Cannot connect to yourself
      if (userId === connectedUserId) {
        return res.status(400).json({ message: "Cannot connect to yourself" });
      }

      // Check if user exists
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, connectedUserId));
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if connection already exists
      const [existingConnection] = await db
        .select()
        .from(connections)
        .where(
          or(
            and(
              eq(connections.userId, userId),
              eq(connections.connectedUserId, connectedUserId)
            ),
            and(
              eq(connections.userId, connectedUserId),
              eq(connections.connectedUserId, userId)
            )
          )
        );
      
      if (existingConnection) {
        return res.status(400).json({ 
          message: "Connection already exists",
          status: existingConnection.status
        });
      }

      // Create connection
      const [newConnection] = await db
        .insert(connections)
        .values({
          userId: userId,
          connectedUserId: connectedUserId,
          status: "pending",
          createdAt: new Date(),
        })
        .returning();

      return res.status(201).json(newConnection);
    } catch (error) {
      console.error("Error creating connection:", error);
      next(error);
    }
  });

  // Accept or reject a connection request (using composite key)
  app.put("/api/connections/:userIdParam/:connectedUserIdParam", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userIdParam = parseInt(req.params.userIdParam);
      const connectedUserIdParam = parseInt(req.params.connectedUserIdParam);
      const userId = req.user!.id;
      const { status } = req.body;
      
      if (isNaN(userIdParam) || isNaN(connectedUserIdParam)) {
        return res.status(400).json({ message: "Invalid connection identifiers" });
      }

      if (!status || !connectionStatuses.includes(status as any)) {
        return res.status(400).json({ 
          message: "Valid status is required (accepted or rejected)"
        });
      }

      // Get the connection
      const [connection] = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.userId, userIdParam),
            eq(connections.connectedUserId, connectedUserIdParam)
          )
        );
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Check if user is the recipient of the request
      if (connection.connectedUserId !== userId) {
        return res.status(403).json({ 
          message: "You can only respond to connection requests sent to you"
        });
      }

      // Check if request is pending
      if (connection.status !== "pending") {
        return res.status(400).json({ 
          message: "This request has already been processed"
        });
      }

      // Update connection status
      const [updatedConnection] = await db
        .update(connections)
        .set({
          status: status as any,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(connections.userId, userIdParam),
            eq(connections.connectedUserId, connectedUserIdParam)
          )
        )
        .returning();

      return res.json(updatedConnection);
    } catch (error) {
      console.error("Error updating connection:", error);
      next(error);
    }
  });

  // ================ POSTS ROUTES ================

  // Get all posts (feed)
  app.get("/api/posts", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      // If user is logged in, show all public posts and posts from connected users
      // If not logged in, show only public posts
      let queryConditions = [];
      
      if (userId) {
        // Get IDs of connected users
        const connections = await db
          .select({
            userId: connections.userId,
            connectedUserId: connections.connectedUserId,
          })
          .from(connections)
          .where(
            and(
              or(
                eq(connections.userId, userId),
                eq(connections.connectedUserId, userId)
              ),
              eq(connections.status, "accepted")
            )
          );
        
        const connectedUserIds = new Set<number>();
        connections.forEach(conn => {
          connectedUserIds.add(conn.userId === userId ? conn.connectedUserId : conn.userId);
        });
        
        // Add the user's own ID
        connectedUserIds.add(userId);
        
        // Posts that are either public or from connected users
        queryConditions.push(
          or(
            eq(posts.isPublic, true),
            and(
              eq(posts.isPublic, false),
              inArray(posts.userId, Array.from(connectedUserIds))
            )
          )
        );
      } else {
        // Only public posts for non-logged in users
        queryConditions.push(eq(posts.isPublic, true));
      }
      
      // Get all posts with user details
      const allPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          createdAt: posts.createdAt,
          imageUrl: posts.imageUrl,
          likes: posts.likes,
          sportType: posts.sportType,
          userId: posts.userId,
          username: users.username,
          fullName: users.fullName,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(and(...queryConditions))
        .orderBy(desc(posts.createdAt));

      return res.json(allPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      next(error);
    }
  });

  // Create a new post
  app.post("/api/posts", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const postData = insertPostSchema.parse({
        ...req.body,
        userId,
        // Default to public if not specified
        isPublic: req.body.isPublic === undefined ? true : req.body.isPublic,
      });

      // Create post
      const [newPost] = await db
        .insert(posts)
        .values(postData)
        .returning();

      // Get user info for response
      const [user] = await db
        .select({
          username: users.username,
          fullName: users.fullName,
        })
        .from(users)
        .where(eq(users.id, userId));

      // Return post with user details
      return res.status(201).json({
        ...newPost,
        username: user.username,
        fullName: user.fullName,
      });
    } catch (error) {
      console.error("Error creating post:", error);
      next(error);
    }
  });

  return app;
}

// Helper function for 'IN' queries since it's not directly exposed by drizzle-orm
function inArray<T extends any>(column: any, values: T[]) {
  return sql`${column} IN (${sql.join(values)})`;
}

function or(...conditions: any[]) {
  return sql`(${sql.join(conditions, sql` OR `)})`;
}