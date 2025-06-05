/**
 * Group events routes
 * These routes handle operations related to group-specific events with proper permission checks
 */
import { Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertGroupEventSchema, insertGroupEventRsvpSchema } from "@shared/schema";

/**
 * Register all group event routes with Express app
 * All routes include authorization checks to ensure only group members can access events
 */
export function registerGroupEventRoutes(app: any, requireAuth: any) {
  // Get all group events for the logged-in user (across all their groups)
  app.get(
    "/api/user/group-events", 
    requireAuth, 
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        
        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to view your group events" });
        }
        
        // Get all groups this user is a member of
        const userGroups = await storage.getGroupsByUserId(userId);
        
        if (!userGroups || userGroups.length === 0) {
          return res.json([]); // User isn't in any groups, return empty array
        }
        
        // Get group IDs
        const groupIds = userGroups.map(group => group.id);
        
        // Use Promise.all to fetch events from all groups in parallel
        const groupEventsPromises = groupIds.map(async (groupId) => {
          try {
            // We know the user is a member, so we can pass the group ID and user ID
            const events = await storage.getGroupEvents({
              groupId,
              userId
            });
            
            // Tag each event with its group ID (to help the frontend)
            return events.map(event => ({
              ...event,
              groupId,
            }));
          } catch (error) {
            console.error(`Error fetching events for group ${groupId}:`, error);
            return []; // Return empty array for this group if there's an error
          }
        });
        
        // Wait for all queries to complete
        const groupEventsArrays = await Promise.all(groupEventsPromises);
        
        // Flatten all group events into a single array
        const allGroupEvents = groupEventsArrays.flat();
        
        res.json(allGroupEvents);
      } catch (error) {
        console.error("Error fetching all user group events:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch group events",
        });
      }
    }
  );
  // Get all events for a specific group
  app.get(
    "/api/groups/:groupId/events",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to view group events" });
        }

        // Check if user is a member of the group
        const isMember = await storage.isUserGroupMember(userId, groupId);
        
        if (!isMember) {
          return res.status(403).json({ 
            message: "You must be a member of this group to view its events" 
          });
        }

        // Get all events for the group with permission check
        const events = await storage.getGroupEvents({
          groupId,
          userId
        });

        res.json(events);
      } catch (error) {
        console.error("Error fetching group events:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch group events",
        });
      }
    }
  );

  // Get a specific group event
  app.get(
    "/api/groups/:groupId/events/:eventId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const eventId = parseInt(req.params.eventId);
        const groupId = parseInt(req.params.groupId);
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to view group events" });
        }

        // Check if user is a member of the group
        const isMember = await storage.isUserGroupMember(userId, groupId);
        
        if (!isMember) {
          return res.status(403).json({ 
            message: "You must be a member of this group to view its events" 
          });
        }

        const event = await storage.getGroupEvent(eventId, userId);

        if (!event) {
          return res.status(404).json({ message: "Group event not found" });
        }

        res.json(event);
      } catch (error) {
        console.error("Error fetching group event:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch group event",
        });
      }
    }
  );

  // Create a new group event
  app.post(
    "/api/groups/:groupId/events",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const groupId = parseInt(req.params.groupId);
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to create group events" });
        }

        // Check if user is a member of the group
        const isMember = await storage.isUserGroupMember(userId, groupId);
        
        if (!isMember) {
          return res.status(403).json({ 
            message: "You must be a member of this group to create events" 
          });
        }

        // Validate request body
        const eventData = insertGroupEventSchema.parse({
          ...req.body,
          groupId: groupId,
          organizerId: userId
        });

        // Create the event
        const newEvent = await storage.createGroupEvent(eventData);

        res.status(201).json(newEvent);
      } catch (error) {
        console.error("Error creating group event:", error);
        
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid event data",
            errors: error.errors,
          });
        }
        
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to create group event",
        });
      }
    }
  );

  // Get all RSVPs for a group event
  app.get(
    "/api/groups/:groupId/events/:eventId/rsvps",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const eventId = parseInt(req.params.eventId);
        const groupId = parseInt(req.params.groupId);
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to view RSVPs" });
        }

        // Check if user is a member of the group
        const isMember = await storage.isUserGroupMember(userId, groupId);
        
        if (!isMember) {
          return res.status(403).json({ 
            message: "You must be a member of this group to view RSVPs" 
          });
        }

        const rsvps = await storage.getRsvpsByGroupEventId(eventId);
        res.json(rsvps);
      } catch (error) {
        console.error("Error fetching group event RSVPs:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to fetch RSVPs",
        });
      }
    }
  );

  // Create or update an RSVP for a group event
  app.post(
    "/api/groups/:groupId/events/:eventId/rsvps",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const eventId = parseInt(req.params.eventId);
        const groupId = parseInt(req.params.groupId);
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ message: "You must be logged in to RSVP" });
        }

        // Check if user is a member of the group
        const isMember = await storage.isUserGroupMember(userId, groupId);
        
        if (!isMember) {
          return res.status(403).json({ 
            message: "You must be a member of this group to RSVP to events" 
          });
        }

        // Validate the status
        const { status } = insertGroupEventRsvpSchema.parse({
          ...req.body,
          eventId,
          userId
        });

        // Create or update RSVP
        const rsvp = await storage.updateGroupEventRsvp(eventId, userId, status);
        res.json(rsvp);
      } catch (error) {
        console.error("Error creating/updating group event RSVP:", error);
        
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Invalid RSVP data",
            errors: error.errors,
          });
        }
        
        res.status(500).json({
          message: error instanceof Error ? error.message : "Failed to update RSVP",
        });
      }
    }
  );
}