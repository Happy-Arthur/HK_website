/**
 * Group admin routes
 * These routes handle operations that can only be performed by group admins
 */
import { Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { db } from "../db";
import { groups, groupEvents, groupMembers, users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Middleware to check if the user is an admin of the specified group
 */
export async function isGroupAdmin(req: Request, res: Response, next: Function) {
  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Check if user is a group admin
    const isAdmin = await storage.isUserGroupAdmin(userId, groupId);
    
    if (!isAdmin) {
      return res.status(403).json({ 
        message: "You must be an admin of this group to perform this action" 
      });
    }
    
    // User is a group admin, proceed to the next middleware/route handler
    next();
  } catch (error) {
    console.error("Error in group admin middleware:", error);
    res.status(500).json({ 
      message: error instanceof Error ? error.message : "Server error in admin check" 
    });
  }
}

export function registerGroupAdminRoutes(app: any, requireAuth: any) {
  // Update group details (admin only)
  app.put(
    "/api/groups/:groupId",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const groupData = req.body;
        
        console.log(`Group admin updating group ${groupId} with data:`, groupData);
        
        // Validate that only allowed fields are updated
        const allowedFields = ["name", "description", "sportType", "district", "imageUrl", "isPrivate"];
        const filteredData = Object.fromEntries(
          Object.entries(groupData).filter(([key]) => allowedFields.includes(key))
        );
        
        // Update the group
        const updatedGroup = await storage.updateGroup(groupId, filteredData);
        
        if (!updatedGroup) {
          return res.status(404).json({ message: "Group not found" });
        }
        
        res.json(updatedGroup);
      } catch (error) {
        console.error("Error updating group:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to update group",
        });
      }
    }
  );
  
  // Update group event (admin only)
  app.put(
    "/api/groups/:groupId/events/:eventId",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const eventId = parseInt(req.params.eventId);
        const eventData = req.body;
        
        console.log(`Group admin updating event ${eventId} in group ${groupId} with data:`, eventData);
        
        // Verify that the event belongs to this group
        const existingEvent = await storage.getGroupEvent(eventId);
        
        if (!existingEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        
        if (existingEvent.groupId !== groupId) {
          return res.status(400).json({ 
            message: "This event does not belong to the specified group" 
          });
        }
        
        // Validate that only allowed fields are updated
        const allowedFields = [
          "name", "description", "eventDate", "startTime", "endTime", 
          "locationName", "address", "latitude", "longitude", 
          "sportType", "skillLevel", "maxParticipants", "notes"
        ];
        
        const filteredData = Object.fromEntries(
          Object.entries(eventData).filter(([key]) => allowedFields.includes(key))
        );
        
        // Update the event
        const updatedEvent = await storage.updateGroupEvent(eventId, filteredData);
        
        if (!updatedEvent) {
          return res.status(404).json({ message: "Event not found or update failed" });
        }
        
        res.json(updatedEvent);
      } catch (error) {
        console.error("Error updating group event:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to update group event",
        });
      }
    }
  );
  
  // Delete group event (admin only)
  app.delete(
    "/api/groups/:groupId/events/:eventId",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const eventId = parseInt(req.params.eventId);
        
        console.log(`Group admin deleting event ${eventId} from group ${groupId}`);
        
        // Verify that the event belongs to this group
        const existingEvent = await storage.getGroupEvent(eventId);
        
        if (!existingEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        
        if (existingEvent.groupId !== groupId) {
          return res.status(400).json({ 
            message: "This event does not belong to the specified group" 
          });
        }
        
        // Delete the event
        await storage.deleteGroupEvent(eventId);
        
        res.json({ message: "Event deleted successfully", id: eventId });
      } catch (error) {
        console.error("Error deleting group event:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to delete group event",
        });
      }
    }
  );
  
  // Remove member from group (admin only)
  app.delete(
    "/api/groups/:groupId/members/:userId",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const memberUserId = parseInt(req.params.userId);
        const adminUserId = req.user!.id;
        
        console.log(`Group admin ${adminUserId} removing user ${memberUserId} from group ${groupId}`);
        
        // Check if target user is a member of the group
        const isMember = await storage.isUserGroupMember(memberUserId, groupId);
        
        if (!isMember) {
          return res.status(404).json({ message: "User is not a member of this group" });
        }
        
        // Prevent admins from removing themselves
        if (memberUserId === adminUserId) {
          return res.status(400).json({ 
            message: "You cannot remove yourself from the group. Transfer admin role first or leave the group normally." 
          });
        }
        
        // Check if target user is also an admin
        const isTargetAdmin = await storage.isUserGroupAdmin(memberUserId, groupId);
        
        if (isTargetAdmin) {
          return res.status(403).json({ 
            message: "You cannot remove another admin from the group" 
          });
        }
        
        // Remove the member
        await storage.removeGroupMember(groupId, memberUserId);
        
        res.json({ 
          message: "Member removed successfully", 
          groupId, 
          userId: memberUserId 
        });
      } catch (error) {
        console.error("Error removing group member:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to remove group member",
        });
      }
    }
  );
  
  // Update member status (for handling join requests - admin only)
  app.put(
    "/api/groups/:groupId/members/:userId/status",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const memberUserId = parseInt(req.params.userId);
        const { status } = req.body;
        
        console.log(`Group admin updating status to "${status}" for user ${memberUserId} in group ${groupId}`);
        
        // Validate status
        const validStatuses = ["approved", "rejected"];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ 
            message: "Invalid status. Status must be 'approved' or 'rejected'" 
          });
        }
        
        // Update the member's status
        await storage.updateGroupMemberStatus(groupId, memberUserId, status);
        
        res.json({ 
          message: `Member status updated to ${status}`, 
          groupId, 
          userId: memberUserId, 
          status 
        });
      } catch (error) {
        console.error("Error updating member status:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to update member status",
        });
      }
    }
  );
  
  // Update member role (for promoting/demoting members - admin only)
  app.put(
    "/api/groups/:groupId/members/:userId/role",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const memberUserId = parseInt(req.params.userId);
        const adminUserId = req.user!.id;
        const { role } = req.body;
        
        console.log(`Group admin ${adminUserId} updating role to "${role}" for user ${memberUserId} in group ${groupId}`);
        
        // Validate role
        const validRoles = ["admin", "moderator", "member"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ 
            message: "Invalid role. Role must be 'admin', 'moderator', or 'member'" 
          });
        }
        
        // Check if target user is a member of the group
        const isMember = await storage.isUserGroupMember(memberUserId, groupId);
        
        if (!isMember) {
          return res.status(404).json({ message: "User is not a member of this group" });
        }
        
        // If demoting self from admin, check if there's another admin
        if (memberUserId === adminUserId && role !== 'admin') {
          // Get all admins of the group
          const members = await storage.getGroupMembers(groupId);
          const admins = members.filter(m => m.role === 'admin');
          
          if (admins.length <= 1) {
            return res.status(400).json({ 
              message: "Cannot demote yourself - you are the only admin. Transfer admin role to another member first." 
            });
          }
        }
        
        // Update the member's role
        await storage.updateGroupMemberRole(groupId, memberUserId, role);
        
        res.json({ 
          message: `Member role updated to ${role}`, 
          groupId, 
          userId: memberUserId, 
          role 
        });
      } catch (error) {
        console.error("Error updating member role:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to update member role",
        });
      }
    }
  );
  
  // Get pending member requests (for private groups - admin only)
  app.get(
    "/api/groups/:groupId/members/pending",
    requireAuth,
    isGroupAdmin,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        
        console.log(`Getting pending members for group ${groupId}`);
        
        // Get all pending members
        const pendingMembers = await db
          .select({
            userId: groupMembers.userId,
            username: users.username,
            fullName: users.fullName,
            email: users.email,
            joinedAt: groupMembers.joinedAt,
            status: groupMembers.status,
          })
          .from(groupMembers)
          .innerJoin(users, eq(groupMembers.userId, users.id))
          .where(
            and(
              eq(groupMembers.groupId, groupId),
              eq(groupMembers.status, "pending")
            )
          )
          .orderBy(desc(groupMembers.joinedAt));
        
        res.json(pendingMembers);
      } catch (error) {
        console.error("Error fetching pending group members:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch pending members",
        });
      }
    }
  );
}