import * as schema from "@shared/schema";
import { CheckIn } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, gt, lt, desc, sql, count, inArray } from "drizzle-orm";
import { z } from "zod";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;

// Create PostgreSQL session store with better configuration
const PostgresSessionStore = connectPg(session);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20, // increase pool max size
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // how long to wait for a connection
});

// Define the storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: number, userData: Partial<schema.User>): Promise<schema.User | undefined>;
  deleteReview(id: number): Promise<void>;
  
  // Group admin operations
  updateGroup(id: number, groupData: Partial<schema.Group>): Promise<schema.Group | undefined>;
  removeGroupMember(groupId: number, userId: number): Promise<void>;
  updateGroupEvent(id: number, eventData: Partial<schema.GroupEvent>): Promise<schema.GroupEvent | undefined>;
  deleteGroupEvent(id: number): Promise<void>;
  updateGroupMemberStatus(groupId: number, userId: number, status: string): Promise<void>;
  updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<void>;
  isUserGroupAdmin(userId: number, groupId: number): Promise<boolean>;

  // Facility operations
  getFacilities(filters?: {
    type?: string;
    district?: string;
    query?: string;
  }): Promise<schema.Facility[]>;
  getFacility(id: number): Promise<schema.Facility | undefined>;
  createFacility(facility: schema.InsertFacility): Promise<schema.Facility>;
  updateFacility(id: number, facility: Partial<schema.Facility>): Promise<schema.Facility | undefined>;

  // Review operations
  getReviewsByFacilityId(
    facilityId: number,
  ): Promise<(schema.Review & { username: string })[]>;
  createReview(review: schema.InsertReview): Promise<schema.Review>;
  getAverageRatingByFacilityId(facilityId: number): Promise<number | null>;

  // Check-in operations
  createCheckIn(checkIn: schema.InsertCheckIn): Promise<schema.CheckIn>;
  getCheckInsByFacilityId(facilityId: number): Promise<schema.CheckIn[]>;
  getCheckInsByUserId(
    userId: number,
  ): Promise<(schema.CheckIn & { facility: schema.Facility })[]>;

  // Event operations (public events)
  getEvents(filters?: {
    type?: string;
    query?: string;
    from?: Date;
    to?: Date;
    facilityId?: number;
    district?: string;
  }): Promise<schema.Event[]>;
  getEvent(id: number): Promise<schema.Event | undefined>;
  createEvent(event: schema.InsertEvent): Promise<schema.Event>;
  updateEvent(id: number, event: Partial<schema.Event>): Promise<schema.Event | undefined>;
  deleteEvent(id: number): Promise<void>;

  // Group Event operations (separate from public events)
  getGroupEvents(filters?: {
    type?: string;
    query?: string;
    from?: Date;
    to?: Date;
    facilityId?: number;
    district?: string;
    groupId: number;
    userId: number; // Required to verify group membership
  }): Promise<schema.GroupEvent[]>;
  getGroupEvent(id: number, userId?: number): Promise<schema.GroupEvent | undefined>;
  createGroupEvent(event: schema.InsertGroupEvent): Promise<schema.GroupEvent>;
  
  // Check if user is a member of a group (for permission checks)
  isUserGroupMember(userId: number, groupId: number): Promise<boolean>;
  getGroupMember(groupId: number, userId: number): Promise<{ userId: number; groupId: number; role: string; status: string; } | undefined>;

  // Event RSVP operations
  getRsvpsByEventId(
    eventId: number,
  ): Promise<(schema.EventRsvp & { username: string })[]>;
  getRsvpByUserAndEvent(
    userId: number,
    eventId: number,
  ): Promise<schema.EventRsvp | undefined>;
  createRsvp(rsvp: schema.InsertEventRsvp): Promise<schema.EventRsvp>;
  updateRsvp(
    userId: number,
    eventId: number,
    status: string,
  ): Promise<schema.EventRsvp>;
  
  // Group Event RSVP operations
  getRsvpsByGroupEventId(
    eventId: number,
  ): Promise<(schema.GroupEventRsvp & { username: string })[]>;
  createGroupEventRsvp(rsvp: schema.InsertGroupEventRsvp): Promise<schema.GroupEventRsvp>;
  updateGroupEventRsvp(
    eventId: number,
    userId: number,
    status: string,
  ): Promise<schema.GroupEventRsvp>;

  // Court availability operations
  getCourtAvailability(
    facilityId: number,
    date: Date,
  ): Promise<schema.CourtAvailability[]>;
  updateCourtAvailability(
    id: number,
    isAvailable: boolean,
  ): Promise<schema.CourtAvailability>;

  // Check-in related methods
  getCheckInsWithUsernames(
    facilityId: number,
  ): Promise<(CheckIn & { username: string; createdAt: Date })[]>;
  
  // Gets estimated number of people at a facility (based on check-ins)
  getEstimatedPeopleCount(facilityId: number): Promise<number>;
  
  // Challenge operations
  getChallenges(filters?: {
    type?: string;
    duration?: string;
    sportType?: string;
    isActive?: boolean;
    district?: string;
    query?: string;
  }): Promise<schema.Challenge[]>;
  getChallenge(id: number): Promise<schema.Challenge | undefined>;
  createChallenge(challenge: schema.InsertChallenge): Promise<schema.Challenge>;
  updateChallenge(id: number, challengeData: Partial<schema.Challenge>): Promise<schema.Challenge | undefined>;
  deleteChallenge(id: number): Promise<void>;
  
  // User Challenge operations
  getUserChallenges(userId: number): Promise<(schema.UserChallenge & { challenge: schema.Challenge })[]>;
  getUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge | undefined>;
  joinChallenge(userChallenge: schema.InsertUserChallenge): Promise<schema.UserChallenge>;
  updateUserChallengeProgress(userId: number, challengeId: number, currentValue: number): Promise<schema.UserChallenge>;
  completeUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge>;
  
  // Achievement operations
  getAchievements(): Promise<schema.Achievement[]>;
  getUserAchievements(userId: number): Promise<(schema.UserAchievement & { achievement: schema.Achievement })[]>;
  
  // Messages operations
  getMessages(
    userId1: number,
    userId2: number,
  ): Promise<schema.Message[]>;
  createMessage(message: schema.InsertMessage): Promise<schema.Message>;
  markMessagesAsRead(
    senderId: number,
    receiverId: number
  ): Promise<void>;

  // Group operations
  getGroups(filters?: {
    query?: string;
    type?: string;
  }): Promise<schema.Group[]>;
  getGroup(id: number): Promise<schema.Group | undefined>;
  getGroupsByUserId(userId: number): Promise<schema.Group[]>;
  getGroupMembers(groupId: number): Promise<{ userId: number; groupId: number; role: string; username: string; email?: string; }[]>;
  getGroupMember(groupId: number, userId: number): Promise<{ userId: number; groupId: number; role: string; status: string; } | undefined>;
  createGroup(group: schema.InsertGroup): Promise<schema.Group>;
  deleteGroup(groupId: number): Promise<void>;
  
  // Challenge operations
  getChallenges(filters?: {
    type?: string;
    duration?: string;
    sportType?: string;
    isActive?: boolean;
    district?: string;
    query?: string;
  }): Promise<schema.Challenge[]>;
  getChallenge(id: number): Promise<schema.Challenge | undefined>;
  createChallenge(challenge: schema.InsertChallenge): Promise<schema.Challenge>;
  updateChallenge(id: number, challengeData: Partial<schema.Challenge>): Promise<schema.Challenge | undefined>;
  deleteChallenge(id: number): Promise<void>;
  
  // User Challenge operations
  getUserChallenges(userId: number): Promise<(schema.UserChallenge & { challenge: schema.Challenge })[]>;
  getUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge | undefined>;
  joinChallenge(userChallenge: schema.InsertUserChallenge): Promise<schema.UserChallenge>;
  updateUserChallengeProgress(userId: number, challengeId: number, currentValue: number): Promise<schema.UserChallenge>;
  completeUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge>;
  
  // Achievement operations
  getAchievements(): Promise<schema.Achievement[]>;
  getUserAchievements(userId: number): Promise<(schema.UserAchievement & { achievement: schema.Achievement })[]>;
  
  // Session store
  sessionStore: any; // Using 'any' type to avoid typescript error
}

// Implement the storage with database operations
export class DatabaseStorage implements IStorage {
  sessionStore: any; // Using 'any' type to avoid TypeScript error
  
  // Group operations
  async getGroups(filters?: {
    query?: string;
    type?: string;
  }): Promise<schema.Group[]> {
    try {
      let query = db.select().from(schema.groups);
      
      // Build an array of conditions to apply
      const conditions = [];

      if (filters) {
        // Type filter - for sportType field
        if (filters.type && filters.type.trim() !== "") {
          console.log(`Filtering groups by type: "${filters.type}"`);
          conditions.push(eq(schema.groups.sportType, filters.type));
        }

        // Text search filter
        if (filters.query && filters.query.trim() !== "") {
          console.log(`Filtering groups by query: "${filters.query}"`);
          conditions.push(
            or(
              sql`${schema.groups.name} ILIKE ${`%${filters.query}%`}`,
              sql`${schema.groups.description} ILIKE ${`%${filters.query}%`}`
            )
          );
        }
      }

      // If we have conditions, apply them
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          query = query.where(conditions[0]);
        } else {
          query = query.where(and(...conditions));
        }
      }

      const groups = await query;
      console.log(`Found ${groups.length} groups with filters:`, filters);
      return groups;
    } catch (error) {
      console.error("Database error fetching groups:", error);
      return [];
    }
  }

  async getGroup(id: number): Promise<schema.Group | undefined> {
    try {
      const [group] = await db
        .select()
        .from(schema.groups)
        .where(eq(schema.groups.id, id));
      return group;
    } catch (error) {
      console.error(`Error fetching group with ID ${id}:`, error);
      return undefined;
    }
  }

  async getGroupsByUserId(userId: number): Promise<schema.Group[]> {
    try {
      // Get all groups where the user is a member
      const groups = await db
        .select({
          ...schema.groups
        })
        .from(schema.groups)
        .innerJoin(
          schema.groupMembers,
          eq(schema.groups.id, schema.groupMembers.groupId)
        )
        .where(eq(schema.groupMembers.userId, userId));
      
      return groups;
    } catch (error) {
      console.error(`Error fetching groups for user ${userId}:`, error);
      return [];
    }
  }

  async createGroup(group: schema.InsertGroup): Promise<schema.Group> {
    try {
      const [createdGroup] = await db
        .insert(schema.groups)
        .values(group)
        .returning();
      
      return createdGroup;
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    }
  }
  
  async getGroupMembers(groupId: number): Promise<{ userId: number; groupId: number; role: string; username: string; email?: string; }[]> {
    try {
      const members = await db
        .select({
          userId: schema.groupMembers.userId,
          groupId: schema.groupMembers.groupId,
          role: schema.groupMembers.role,
          username: schema.users.username,
          email: schema.users.email,
        })
        .from(schema.groupMembers)
        .innerJoin(
          schema.users,
          eq(schema.groupMembers.userId, schema.users.id)
        )
        .where(
          and(
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.status, "approved")
          )
        );
      
      return members;
    } catch (error) {
      console.error(`Error fetching members for group ${groupId}:`, error);
      return [];
    }
  }
  
  async deleteGroup(groupId: number): Promise<void> {
    try {
      // First get the group to make sure it exists
      const group = await this.getGroup(groupId);
      if (!group) {
        throw new Error(`Group with ID ${groupId} not found`);
      }
      
      // Delete all group members (cascade will handle related data)
      await db
        .delete(schema.groupMembers)
        .where(eq(schema.groupMembers.groupId, groupId));
      
      // Delete the group
      await db
        .delete(schema.groups)
        .where(eq(schema.groups.id, groupId));
      
      console.log(`Group ${groupId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting group ${groupId}:`, error);
      throw error;
    }
  }
  
  async isUserGroupMember(userId: number, groupId: number): Promise<boolean> {
    try {
      // Check if user is a member of the group with "approved" status
      const [member] = await db
        .select()
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, userId),
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.status, "approved")
          )
        );
      
      return !!member; // Return true if member exists, false otherwise
    } catch (error) {
      console.error(`Error checking if user ${userId} is a member of group ${groupId}:`, error);
      return false; // Return false on error
    }
  }
  
  async isUserGroupAdmin(userId: number, groupId: number): Promise<boolean> {
    try {
      // Check if user is an admin of the group
      const [member] = await db
        .select()
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, userId),
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.status, "approved"),
            eq(schema.groupMembers.role, "admin")
          )
        );
      
      return !!member; // Return true if admin member exists, false otherwise
    } catch (error) {
      console.error(`Error checking if user ${userId} is an admin of group ${groupId}:`, error);
      return false; // Return false on error
    }
  }
  
  async getGroupMember(groupId: number, userId: number): Promise<{ userId: number; groupId: number; role: string; status: string; } | undefined> {
    try {
      // Get the specific group member
      const [member] = await db
        .select({
          userId: schema.groupMembers.userId,
          groupId: schema.groupMembers.groupId,
          role: schema.groupMembers.role,
          status: schema.groupMembers.status,
        })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, userId),
            eq(schema.groupMembers.groupId, groupId)
          )
        );
      
      // If we found a member but role or status is null, use defaults
      if (member) {
        const processedMember = {
          userId: member.userId,
          groupId: member.groupId,
          role: member.role || 'member', // Default to 'member' if null
          status: member.status || 'pending', // Default to 'pending' if null
        };
        return processedMember;
      }
      
      return undefined;
    } catch (error) {
      console.error(`Error fetching member data for user ${userId} in group ${groupId}:`, error);
      return undefined;
    }
  }
  
  async updateGroup(id: number, groupData: Partial<schema.Group>): Promise<schema.Group | undefined> {
    try {
      console.log(`Updating group ${id} with data:`, groupData);
      
      // Validate that group exists first
      const existingGroup = await this.getGroup(id);
      if (!existingGroup) {
        console.log(`Group with ID ${id} not found for update`);
        return undefined;
      }
      
      // Update the group
      const [updatedGroup] = await db
        .update(schema.groups)
        .set({
          ...groupData,
          // Don't allow updating certain fields
          id: undefined,
          createdAt: undefined,
          creatorId: undefined,
        })
        .where(eq(schema.groups.id, id))
        .returning();
      
      console.log(`Group ${id} updated successfully`);
      return updatedGroup;
    } catch (error) {
      console.error(`Error updating group ${id}:`, error);
      throw error;
    }
  }
  
  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    try {
      console.log(`Removing user ${userId} from group ${groupId}`);
      
      // Delete the group member
      await db
        .delete(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.userId, userId)
          )
        );
      
      console.log(`User ${userId} removed from group ${groupId} successfully`);
    } catch (error) {
      console.error(`Error removing user ${userId} from group ${groupId}:`, error);
      throw error;
    }
  }
  
  async updateGroupEvent(id: number, eventData: Partial<schema.GroupEvent>): Promise<schema.GroupEvent | undefined> {
    try {
      console.log(`Updating group event ${id} with data:`, eventData);
      
      // Validate that event exists first
      const existingEvent = await this.getGroupEvent(id);
      if (!existingEvent) {
        console.log(`Group event with ID ${id} not found for update`);
        return undefined;
      }
      
      // Process the event data to handle any date conversions
      const processedEvent: Record<string, any> = {};
      
      // Fields we don't want to update
      const protectedFields = ['id', 'groupId', 'createdAt'];
      
      // Copy over properties, but handle date fields specially
      for (const [key, value] of Object.entries(eventData)) {
        // Skip null/undefined values and protected fields
        if (value === null || value === undefined || protectedFields.includes(key)) {
          continue;
        }
        
        // Skip any functions or objects that aren't meant to be stored
        if (typeof value === 'function' || (typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value))) {
          continue;
        }
        
        // Handle date fields - ensure they are proper Date objects or strings
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
          if (typeof value === 'string') {
            // Try to convert string to date if it's a date field
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                processedEvent[key] = date;
              } else {
                // If invalid date string, skip this field
                console.log(`Invalid date value for ${key}: ${value}, skipping`);
              }
            } catch (e) {
              // If conversion fails, log and skip
              console.log(`Error converting date for ${key}: ${value}, skipping`, e);
            }
          } else if (value instanceof Date) {
            processedEvent[key] = value;
          }
        } else {
          // For non-date fields, use the value as is
          processedEvent[key] = value;
        }
      }
      
      console.log(`Processed group event data for update:`, processedEvent);
      
      // Update the event only if we have valid data to update
      if (Object.keys(processedEvent).length === 0) {
        console.log(`No valid data to update for group event ${id}`);
        return existingEvent;
      }
      
      const [updatedEvent] = await db
        .update(schema.groupEvents)
        .set(processedEvent)
        .where(eq(schema.groupEvents.id, id))
        .returning();
      
      console.log(`Group event ${id} updated successfully`);
      return updatedEvent;
    } catch (error) {
      console.error(`Error updating group event ${id}:`, error);
      throw error;
    }
  }
  
  async deleteGroupEvent(id: number): Promise<void> {
    try {
      console.log(`Deleting group event ${id}`);
      
      // First delete RSVPs to avoid foreign key constraint issues
      await db
        .delete(schema.groupEventRsvps)
        .where(eq(schema.groupEventRsvps.eventId, id));
      
      // Then delete the event
      await db
        .delete(schema.groupEvents)
        .where(eq(schema.groupEvents.id, id));
      
      console.log(`Group event ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting group event ${id}:`, error);
      throw error;
    }
  }
  
  async updateGroupMemberStatus(groupId: number, userId: number, status: string): Promise<void> {
    try {
      console.log(`Updating status to "${status}" for user ${userId} in group ${groupId}`);
      
      // Update the member's status
      await db
        .update(schema.groupMembers)
        .set({ status })
        .where(
          and(
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.userId, userId)
          )
        );
      
      console.log(`Status updated successfully for user ${userId} in group ${groupId}`);
    } catch (error) {
      console.error(`Error updating status for user ${userId} in group ${groupId}:`, error);
      throw error;
    }
  }
  
  async updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<void> {
    try {
      console.log(`Updating role to "${role}" for user ${userId} in group ${groupId}`);
      
      // Update the member's role
      await db
        .update(schema.groupMembers)
        .set({ role })
        .where(
          and(
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.userId, userId)
          )
        );
      
      console.log(`Role updated successfully for user ${userId} in group ${groupId}`);
    } catch (error) {
      console.error(`Error updating role for user ${userId} in group ${groupId}:`, error);
      throw error;
    }
  }
  
  // Messages operations
  async getMessages(userId1: number, userId2: number): Promise<schema.Message[]> {
    try {
      // Get messages between these two users (in either direction)
      const messages = await db
        .select()
        .from(schema.messages)
        .where(
          or(
            and(
              eq(schema.messages.senderId, userId1),
              eq(schema.messages.receiverId, userId2)
            ),
            and(
              eq(schema.messages.senderId, userId2),
              eq(schema.messages.receiverId, userId1)
            )
          )
        )
        .orderBy(desc(schema.messages.createdAt));
      
      return messages;
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }
  
  async createMessage(message: schema.InsertMessage): Promise<schema.Message> {
    try {
      const [createdMessage] = await db
        .insert(schema.messages)
        .values(message)
        .returning();
      
      return createdMessage;
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }
  
  async markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
    try {
      // Mark all messages from senderId to receiverId as read
      await db
        .update(schema.messages)
        .set({ read: true })
        .where(
          and(
            eq(schema.messages.senderId, senderId),
            eq(schema.messages.receiverId, receiverId)
          )
        );
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  constructor() {
    // Set up session store with more robust configuration
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      tableName: "session", // Name of the session table
      schemaName: "public", // Schema for the session table
      ttl: 86400, // Session expiry in seconds (1 day)
      pruneSessionInterval: 60, // Cleanup interval in seconds
    });
    console.log("PostgreSQL session store initialized");
  }

  // User operations
  async getUser(id: number): Promise<schema.User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username));
    return user;
  }

  async deleteReview(id: number): Promise<void> {
    try {
      await db.delete(schema.reviews).where(eq(schema.reviews.id, id));

      console.log(`Review with ID ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting review with ID ${id}:`, error);
      throw error;
    }
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [createdUser] = await db
      .insert(schema.users)
      .values(user)
      .returning();
    return createdUser;
  }

  async updateUser(id: number, userData: Partial<schema.User>): Promise<schema.User | undefined> {
    try {
      console.log(`Updating user ${id} with data:`, userData);
      
      // Validate that user exists first
      const existingUser = await this.getUser(id);
      if (!existingUser) {
        console.log(`User with ID ${id} not found for update`);
        return undefined;
      }
      
      // Process the user data to handle any date conversions
      const processedUserData: Record<string, any> = {};
      
      // Fields we don't want to update
      const protectedFields = ['id'];
      
      // Copy over properties, but handle date fields specially
      for (const [key, value] of Object.entries(userData)) {
        // Skip null/undefined values and protected fields
        if (value === null || value === undefined || protectedFields.includes(key)) {
          continue;
        }
        
        // Skip any functions or objects that aren't meant to be stored
        if (typeof value === 'function' || (typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value) && value !== null)) {
          continue;
        }
        
        // Handle date fields - ensure they are proper Date objects or strings
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
          if (typeof value === 'string') {
            // Try to convert string to date if it's a date field
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                processedUserData[key] = date;
              } else {
                // If invalid date string, skip this field
                console.log(`Invalid date value for ${key}: ${value}, skipping`);
              }
            } catch (e) {
              // If conversion fails, log and skip
              console.log(`Error converting date for ${key}: ${value}, skipping`, e);
            }
          } else if (value instanceof Date) {
            processedUserData[key] = value;
          }
        } else {
          // For non-date fields, use the value as is
          processedUserData[key] = value;
        }
      }
      
      console.log(`Processed user data for update:`, processedUserData);
      
      // Update the user only if we have valid data to update
      if (Object.keys(processedUserData).length === 0) {
        console.log(`No valid data to update for user ${id}`);
        return existingUser;
      }
      
      // Update the user
      const [updatedUser] = await db
        .update(schema.users)
        .set(processedUserData)
        .where(eq(schema.users.id, id))
        .returning();
      
      return updatedUser;
    } catch (error) {
      console.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  // Facility operations
  async getFacilities(filters?: {
    type?: string;
    district?: string;
    query?: string;
  }): Promise<schema.Facility[]> {
    try {
      // Use a raw SQL query first to check if approval_status column exists
      const columnCheckResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'facilities' 
        AND column_name = 'approval_status'
      `);
      
      const hasApprovalColumn = columnCheckResult.length > 0;
      console.log(`Facilities table ${hasApprovalColumn ? 'has' : 'does not have'} approval_status column`);
      
      // Select only columns we know exist
      let query = db.select({
        id: schema.facilities.id,
        name: schema.facilities.name,
        description: schema.facilities.description,
        type: schema.facilities.type,
        district: schema.facilities.district,
        address: schema.facilities.address,
        latitude: schema.facilities.latitude,
        longitude: schema.facilities.longitude,
        openTime: schema.facilities.openTime,
        closeTime: schema.facilities.closeTime,
        contactPhone: schema.facilities.contactPhone,
        imageUrl: schema.facilities.imageUrl,
        courts: schema.facilities.courts,
        amenities: schema.facilities.amenities,
        ageRestriction: schema.facilities.ageRestriction,
        genderSuitability: schema.facilities.genderSuitability,
        createdAt: schema.facilities.createdAt,
        averageRating: schema.facilities.averageRating,
        totalReviews: schema.facilities.totalReviews
      }).from(schema.facilities);

      // Build an array of conditions to apply
      const conditions = [];

      if (filters) {
        // Type filter - explicitly check if it's a non-empty string
        if (
          filters.type &&
          typeof filters.type === "string" &&
          filters.type.trim() !== ""
        ) {
          console.log(`Filtering facilities by type: "${filters.type}"`);
          conditions.push(eq(schema.facilities.type, filters.type));
        }

        // District filter - explicitly check if it's a non-empty string
        if (
          filters.district &&
          typeof filters.district === "string" &&
          filters.district.trim() !== ""
        ) {
          console.log(`Filtering facilities by district: "${filters.district}"`);
          conditions.push(eq(schema.facilities.district, filters.district));
        }

        // Text search filter
        if (filters.query && filters.query.trim() !== "") {
          console.log(`Filtering facilities by query: "${filters.query}"`);
          // Use ILIKE for case-insensitive search
          conditions.push(
            sql`${schema.facilities.name} ILIKE ${`%${filters.query}%`}`,
          );
        }
      }

      // If we have conditions, apply them with AND
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          query = query.where(conditions[0]);
        } else {
          query = query.where(and(...conditions));
        }
      }

      console.log(
        `Executing facility query with ${conditions.length} conditions`,
      );

      const facilities = await query;
      console.log(
        `Found ${facilities.length} facilities with filters:`,
        filters,
      );
      return facilities;
    } catch (error) {
      console.error("Database error fetching facilities:", error);
      // Return empty array in case of error to prevent app crash
      return [];
    }
  }

  async getFacility(id: number): Promise<schema.Facility | undefined> {
    const [facility] = await db
      .select()
      .from(schema.facilities)
      .where(eq(schema.facilities.id, id));
    return facility;
  }

  async createFacility(
    facility: schema.InsertFacility,
  ): Promise<schema.Facility> {
    const [createdFacility] = await db
      .insert(schema.facilities)
      .values(facility)
      .returning();
    return createdFacility;
  }
  
  async updateFacility(id: number, facility: Partial<schema.Facility>): Promise<schema.Facility | undefined> {
    try {
      console.log(`Updating facility ${id} with data:`, facility);
      
      // Check if facility exists
      const [existingFacility] = await db
        .select()
        .from(schema.facilities)
        .where(eq(schema.facilities.id, id));
        
      if (!existingFacility) {
        console.log(`Facility with ID ${id} not found for update`);
        return undefined;
      }
      
      // Process the facility data to handle any date conversions
      // and remove any properties that shouldn't be sent directly to the database
      const processedFacility: Record<string, any> = {};
      
      // Copy over properties, but handle date fields specially
      for (const [key, value] of Object.entries(facility)) {
        // Skip null/undefined values and id field which we don't want to update
        if (value === null || value === undefined || key === 'id') {
          continue;
        }
        
        // Skip any functions or objects that aren't meant to be stored
        if (typeof value === 'function' || (typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value))) {
          continue;
        }
        
        // Handle date fields - ensure they are proper Date objects or strings
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
          if (typeof value === 'string') {
            // Try to convert string to date if it's a date field
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                processedFacility[key] = date;
              } else {
                // If invalid date string, use the original value
                processedFacility[key] = value;
              }
            } catch (e) {
              // If conversion fails, use the original value
              processedFacility[key] = value;
            }
          } else if (value instanceof Date) {
            processedFacility[key] = value;
          }
        } else {
          // For non-date fields, use the value as is
          processedFacility[key] = value;
        }
      }
      
      console.log(`Processed facility data for update:`, processedFacility);
      
      // Update the facility
      const [updatedFacility] = await db
        .update(schema.facilities)
        .set(processedFacility)
        .where(eq(schema.facilities.id, id))
        .returning();
      
      console.log(`Facility ${id} updated successfully`);
      return updatedFacility;
    } catch (error) {
      console.error(`Error updating facility ${id}:`, error);
      throw error;
    }
  }

  // Review operations
  async getReviewsByFacilityId(
    facilityId: number,
  ): Promise<(schema.Review & { username: string })[]> {
    const reviews = await db
      .select({
        ...schema.reviews,
        username: schema.users.username,
      })
      .from(schema.reviews)
      .innerJoin(schema.users, eq(schema.reviews.userId, schema.users.id))
      .where(eq(schema.reviews.facilityId, facilityId))
      .orderBy(desc(schema.reviews.createdAt));

    return reviews;
  }

  async createReview(review: schema.InsertReview): Promise<schema.Review> {
    const [createdReview] = await db
      .insert(schema.reviews)
      .values(review)
      .returning();
    return createdReview;
  }

  async getAverageRatingByFacilityId(
    facilityId: number,
  ): Promise<number | null> {
    // First check if there are any reviews for this facility
    const reviewCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.reviews)
      .where(eq(schema.reviews.facilityId, facilityId));

    // If no reviews, return null
    if (reviewCount[0].count === 0) {
      return null;
    }

    // Otherwise calculate the average rating
    const [result] = await db
      .select({
        avgRating: sql<number>`ROUND(AVG(${schema.reviews.rating}), 1)`,
      })
      .from(schema.reviews)
      .where(eq(schema.reviews.facilityId, facilityId));

    // Return the averaged value, or 0 if something went wrong
    return result?.avgRating ?? null;
  }

  // Check-in operations
  async createCheckIn(checkIn: schema.InsertCheckIn): Promise<schema.CheckIn> {
    try {
      const [createdCheckIn] = await db
        .insert(schema.checkIns)
        .values({
          ...checkIn,
          createdAt: new Date(), // Ensure we have a fresh timestamp
        })
        .returning();

      console.log(
        `Created check-in: User ${checkIn.userId} at facility ${checkIn.facilityId}`,
      );
      return createdCheckIn;
    } catch (error) {
      console.error("Error creating check-in:", error);
      throw error;
    }
  }

  async getCheckInsByFacilityId(facilityId: number): Promise<schema.CheckIn[]> {
    return await db
      .select()
      .from(schema.checkIns)
      .where(eq(schema.checkIns.facilityId, facilityId))
      .orderBy(desc(schema.checkIns.createdAt));
  }

  async getCheckInsByUserId(
    userId: number,
  ): Promise<(schema.CheckIn & { facility: schema.Facility })[]> {
    const checkIns = await db
      .select({
        ...schema.checkIns,
        facility: schema.facilities,
      })
      .from(schema.checkIns)
      .innerJoin(
        schema.facilities,
        eq(schema.checkIns.facilityId, schema.facilities.id),
      )
      .where(eq(schema.checkIns.userId, userId))
      .orderBy(desc(schema.checkIns.createdAt));

    return checkIns;
  }

  // Event operations
  async getEvents(filters?: {
    type?: string;
    query?: string;
    from?: Date;
    to?: Date;
    facilityId?: number;
    district?: string;
    groupId?: number;
    userId?: number; // To filter events by user's groups
  }): Promise<schema.Event[]> {
    try {
      // Use a raw SQL query first to check if approval_status column exists
      const columnCheckResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'approval_status'
      `);
      
      const hasApprovalColumn = columnCheckResult.length > 0;
      console.log(`Events table ${hasApprovalColumn ? 'has' : 'does not have'} approval_status column`);
      
      // Select only columns we know exist
      let query = db.select({
        id: schema.events.id,
        name: schema.events.name,
        description: schema.events.description,
        facilityId: schema.events.facilityId,
        eventDate: schema.events.eventDate,
        startTime: schema.events.startTime,
        endTime: schema.events.endTime,
        sportType: schema.events.sportType,
        skillLevel: schema.events.skillLevel,
        maxParticipants: schema.events.maxParticipants,
        isOfficial: schema.events.isOfficial,
        createdAt: schema.events.createdAt,
        organizerId: schema.events.organizerId
      }).from(schema.events);

      if (filters) {
        if (filters.type) {
          // Debug log to verify the type filter is received correctly
          console.log(`Filtering events by type: ${filters.type}`);
          query = query.where(eq(schema.events.sportType, filters.type));
        }

        if (filters.query && filters.query.trim() !== "") {
          console.log(`Filtering events by text query: "${filters.query}"`);
          // Use ILIKE for case-insensitive search in name and description
          query = query.where(
            or(
              sql`${schema.events.name} ILIKE ${'%' + filters.query + '%'}`,
              sql`${schema.events.description} ILIKE ${'%' + filters.query + '%'}`
            )
          );
        }

        if (filters.facilityId) {
          console.log(`Filtering events by facilityId: ${filters.facilityId}`);
          query = query.where(eq(schema.events.facilityId, filters.facilityId));
        }

        if (filters.from) {
          query = query.where(gt(schema.events.eventDate, filters.from));
        }

        if (filters.to) {
          query = query.where(lt(schema.events.eventDate, filters.to));
        }
        
        if (filters.district) {
          console.log(`Filtering events by district: ${filters.district}`);
          
          // Join with facilities to filter by district without overriding existing where conditions
          query = query
            .innerJoin(
              schema.facilities,
              eq(schema.events.facilityId, schema.facilities.id)
            );
            
          // Add district filter as an AND condition instead of replacing existing where conditions
          query = query.where(eq(schema.facilities.district, filters.district));
        }
        
        // Apply group filter
        if (filters.groupId) {
          console.log(`Filtering events by groupId: ${filters.groupId}`);
          query = query.where(eq(schema.events.groupId, filters.groupId));
        }
        
        // If userId is provided, include events that are visible to this user
        // (public events + events from groups the user is a member of)
        if (filters.userId) {
          console.log(`Filtering events visible to user: ${filters.userId}`);
          
          // Get the groups the user is a member of with approved status only
          const userGroups = await db
            .select({ groupId: schema.groupMembers.groupId })
            .from(schema.groupMembers)
            .where(and(
              eq(schema.groupMembers.userId, filters.userId),
              eq(schema.groupMembers.status, "approved")
            ));
          
          const userGroupIds = userGroups.map(g => g.groupId);
          
          // If a specific group ID is requested, check membership
          if (filters.groupId) {
            // If user is requesting events for a specific group, verify membership
            const isMember = userGroupIds.includes(filters.groupId);
            
            if (!isMember) {
              console.log(`User ${filters.userId} is not a member of group ${filters.groupId}, returning empty results`);
              // User is not a member of the requested group, return empty set
              return [];
            }
            // Continue with the existing group filter, membership is confirmed
          } else {
            // No specific group requested, show public events and events from user's groups
            if (userGroupIds.length > 0) {
              console.log(`User is in ${userGroupIds.length} approved groups: ${userGroupIds.join(', ')}`);
              // Include public events (groupId IS NULL) or events from user's groups
              query = query.where(
                or(
                  sql`${schema.events.groupId} IS NULL`,
                  sql`${schema.events.groupId} IN (${sql.join(userGroupIds.map(id => sql`${id}`), sql`, `)})`
                )
              );
            } else {
              console.log(`User is not in any groups, showing only public events`);
              // User is not in any groups, show only public events
              query = query.where(sql`${schema.events.groupId} IS NULL`);
            }
          }
        } else if (filters.groupId) {
          // If only groupId provided but no userId, we need to check if this is a private group
          const [group] = await db
            .select()
            .from(schema.groups)
            .where(eq(schema.groups.id, filters.groupId));
            
          if (group && group.isPrivate) {
            console.log(`Group ${filters.groupId} is private and no user ID provided, public access denied`);
            // Return empty set for private groups when no user ID is provided
            return [];
          }
          // Continue with the existing filter (public group or admin access)
        }
      }

      const events = await query.orderBy(
        schema.events.eventDate,
        schema.events.startTime,
      );
      console.log(`Found ${events.length} events with filters:`, filters);
      return events;
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  }

  async getEvent(id: number): Promise<(schema.Event & { 
    organizerName?: string; 
    facilityName?: string;
    groupName?: string;
    attendeeCount?: number;
  }) | undefined> {
    try {
      // First check if the event exists
      const [event] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, id));
      
      if (!event) {
        console.log(`Event with ID ${id} not found`);
        return undefined;
      }
      
      // Get the organizer name
      let organizerName: string | undefined;
      if (event.organizerId) {
        const [organizer] = await db
          .select({
            fullName: schema.users.fullName,
            username: schema.users.username,
          })
          .from(schema.users)
          .where(eq(schema.users.id, event.organizerId));
          
        organizerName = organizer?.fullName || organizer?.username;
      }
      
      // Get the facility name
      let facilityName: string | undefined;
      if (event.facilityId) {
        const [facility] = await db
          .select({
            name: schema.facilities.name,
          })
          .from(schema.facilities)
          .where(eq(schema.facilities.id, event.facilityId));
          
        facilityName = facility?.name;
      }
      
      // Get the group name if the event is associated with a group
      let groupName: string | undefined;
      if (event.groupId) {
        const [group] = await db
          .select({
            name: schema.groups.name,
          })
          .from(schema.groups)
          .where(eq(schema.groups.id, event.groupId));
          
        groupName = group?.name;
      }
      
      // Get attendee count
      const [{ count: attendeeCount }] = await db
        .select({
          count: count(),
        })
        .from(schema.eventRsvps)
        .where(
          and(
            eq(schema.eventRsvps.eventId, id),
            eq(schema.eventRsvps.status, "going")
          )
        );
      
      // Return enhanced event with additional information
      return {
        ...event,
        organizerName,
        facilityName,
        groupName,
        attendeeCount: Number(attendeeCount),
      };
    } catch (error) {
      console.error(`Error fetching event with ID ${id}:`, error);
      return undefined;
    }
  }

  async createEvent(event: schema.InsertEvent): Promise<schema.Event> {
    const [createdEvent] = await db
      .insert(schema.events)
      .values(event)
      .returning();
    return createdEvent;
  }
  
  async updateEvent(id: number, event: Partial<schema.Event>): Promise<schema.Event | undefined> {
    try {
      // Check if the event exists
      const [existingEvent] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, id));
        
      if (!existingEvent) {
        console.log(`Event with ID ${id} not found for update`);
        return undefined;
      }
      
      console.log(`Updating event ${id} with data:`, event);
      
      // Process the event data to handle any date conversions
      const processedEvent: Record<string, any> = {};
      
      // Copy over properties, but handle date fields specially
      for (const [key, value] of Object.entries(event)) {
        // Skip null/undefined values and id field which we don't want to update
        if (value === null || value === undefined || key === 'id') {
          continue;
        }
        
        // Skip any functions or objects that aren't meant to be stored
        if (typeof value === 'function' || (typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value))) {
          continue;
        }
        
        // Handle date fields - ensure they are proper Date objects or strings
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
          if (typeof value === 'string') {
            // Try to convert string to date if it's a date field
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                processedEvent[key] = date;
              } else {
                // If invalid date string, use the original value
                processedEvent[key] = value;
              }
            } catch (e) {
              // If conversion fails, use the original value
              processedEvent[key] = value;
            }
          } else if (value instanceof Date) {
            processedEvent[key] = value;
          }
        } else {
          // For non-date fields, use the value as is
          processedEvent[key] = value;
        }
      }
      
      console.log(`Processed event data for update:`, processedEvent);
      
      // Update the event
      const [updatedEvent] = await db
        .update(schema.events)
        .set(processedEvent)
        .where(eq(schema.events.id, id))
        .returning();
      
      console.log(`Event ${id} updated successfully`);
      return updatedEvent;
    } catch (error) {
      console.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }
  
  async deleteEvent(id: number): Promise<void> {
    try {
      // First check if the event exists
      const [event] = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.id, id));
      
      if (!event) {
        throw new Error(`Event with ID ${id} not found`);
      }
      
      // Delete all RSVPs for this event
      await db
        .delete(schema.eventRsvps)
        .where(eq(schema.eventRsvps.eventId, id));
      
      // Delete the event
      await db
        .delete(schema.events)
        .where(eq(schema.events.id, id));
      
      console.log(`Event ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }

  // RSVP operations
  async isUserGroupMember(userId: number, groupId: number): Promise<boolean> {
    try {
      const [member] = await db
        .select()
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.userId, userId),
            eq(schema.groupMembers.groupId, groupId),
            eq(schema.groupMembers.status, "approved") // Only approved members count
          )
        );
      
      return !!member;
    } catch (error) {
      console.error(`Error checking if user ${userId} is member of group ${groupId}:`, error);
      return false;
    }
  }

  async getRsvpsByEventId(
    eventId: number,
  ): Promise<(schema.EventRsvp & { username: string })[]> {
    const rsvps = await db
      .select({
        ...schema.eventRsvps,
        username: schema.users.username,
      })
      .from(schema.eventRsvps)
      .innerJoin(schema.users, eq(schema.eventRsvps.userId, schema.users.id))
      .where(eq(schema.eventRsvps.eventId, eventId));

    return rsvps;
  }

  async getRsvpByUserAndEvent(
    userId: number,
    eventId: number
  ): Promise<schema.EventRsvp | undefined> {
    try {
      const [rsvp] = await db
        .select()
        .from(schema.eventRsvps)
        .where(
          and(
            eq(schema.eventRsvps.eventId, eventId),
            eq(schema.eventRsvps.userId, userId)
          )
        );
      
      return rsvp;
    } catch (error) {
      console.error(`Error getting RSVP for user ${userId} and event ${eventId}:`, error);
      return undefined;
    }
  }

  async createRsvp(rsvp: schema.InsertEventRsvp): Promise<schema.EventRsvp> {
    const [createdRsvp] = await db
      .insert(schema.eventRsvps)
      .values(rsvp)
      .returning();
    return createdRsvp;
  }

  async updateRsvp(
    userId: number,
    eventId: number,
    status: string,
  ): Promise<schema.EventRsvp> {
    const [updatedRsvp] = await db
      .update(schema.eventRsvps)
      .set({ status })
      .where(
        and(
          eq(schema.eventRsvps.eventId, eventId),
          eq(schema.eventRsvps.userId, userId),
        ),
      )
      .returning();

    return updatedRsvp;
  }
  
  // Group Event operations
  async getGroupEvents(filters?: {
    type?: string;
    query?: string;
    from?: Date;
    to?: Date;
    facilityId?: number;
    district?: string;
    groupId: number;
    userId: number; // Required to verify group membership
  }): Promise<schema.GroupEvent[]> {
    try {
      // First check if user is a member of the group
      if (!filters || !filters.groupId || !filters.userId) {
        console.log("Missing required filters: groupId and userId");
        return [];
      }
      
      const isMember = await this.isUserGroupMember(filters.userId, filters.groupId);
      if (!isMember) {
        console.log(`User ${filters.userId} is not a member of group ${filters.groupId}`);
        return [];
      }
      
      // Build the query with all necessary fields
      let query = db.select().from(schema.groupEvents);
      
      // Build conditions array
      const conditions = [eq(schema.groupEvents.groupId, filters.groupId)];
      
      if (filters) {
        // Add type filter
        if (filters.type && filters.type.trim() !== "") {
          conditions.push(eq(schema.groupEvents.sportType, filters.type));
        }
        
        // Add facility filter
        // Removed facilityId and district filters since they're not in our database schema
        
        // Add date range filters
        if (filters.from) {
          conditions.push(gt(schema.groupEvents.eventDate, filters.from));
        }
        
        if (filters.to) {
          conditions.push(lt(schema.groupEvents.eventDate, filters.to));
        }
        
        // Add text search filter
        if (filters.query && filters.query.trim() !== "") {
          conditions.push(
            or(
              sql`${schema.groupEvents.name} ILIKE ${`%${filters.query}%`}`,
              sql`${schema.groupEvents.description} ILIKE ${`%${filters.query}%`}`
            )
          );
        }
      }
      
      // Apply all conditions with AND
      query = query.where(and(...conditions));
      
      // Order by date
      query = query.orderBy(schema.groupEvents.eventDate, schema.groupEvents.startTime);
      
      // Execute query and return results
      const events = await query;
      console.log(`Found ${events.length} group events for group ${filters.groupId}`);
      return events;
    } catch (error) {
      console.error("Error fetching group events:", error);
      return [];
    }
  }
  
  async getGroupEvent(id: number, userId?: number): Promise<schema.GroupEvent | undefined> {
    try {
      // First get the basic event
      const [event] = await db
        .select()
        .from(schema.groupEvents)
        .where(eq(schema.groupEvents.id, id));
        
      if (!event) {
        console.log(`Group event with ID ${id} not found`);
        return undefined;
      }
      
      // If userId is provided, check if user is a member of the group
      if (userId) {
        const isMember = await this.isUserGroupMember(userId, event.groupId);
        if (!isMember) {
          console.log(`User ${userId} is not a member of group ${event.groupId}`);
          return undefined;
        }
      }
      
      // Get the organizer name
      let organizerName: string | undefined;
      if (event.organizerId) {
        const [organizer] = await db
          .select({
            fullName: schema.users.fullName,
            username: schema.users.username,
          })
          .from(schema.users)
          .where(eq(schema.users.id, event.organizerId));
          
        organizerName = organizer?.fullName || organizer?.username;
      }
      
      // Get the facility name
      // Use locationName as the facility name since we dont have facilityId in the schema
      const facilityName = event.locationName;
      
      // Get the group name
      let groupName: string | undefined;
      if (event.groupId) {
        const [group] = await db
          .select({
            name: schema.groups.name,
          })
          .from(schema.groups)
          .where(eq(schema.groups.id, event.groupId));
          
        groupName = group?.name;
      }
      
      // Get attendee count
      const [{ count: attendeeCount }] = await db
        .select({
          count: count(),
        })
        .from(schema.groupEventRsvps)
        .where(
          and(
            eq(schema.groupEventRsvps.eventId, id),
            eq(schema.groupEventRsvps.status, "going")
          )
        );
      
      // Return enhanced event with additional information
      return {
        ...event,
        organizerName,
        facilityName,
        groupName,
        attendeeCount: Number(attendeeCount),
      };
    } catch (error) {
      console.error(`Error fetching group event with ID ${id}:`, error);
      return undefined;
    }
  }
  
  async createGroupEvent(event: schema.InsertGroupEvent): Promise<schema.GroupEvent> {
    try {
      // Make sure the user creating the event is a member of the group
      const isMember = await this.isUserGroupMember(event.organizerId, event.groupId);
      if (!isMember) {
        throw new Error(`User ${event.organizerId} is not a member of group ${event.groupId}`);
      }
      
      const [createdEvent] = await db
        .insert(schema.groupEvents)
        .values(event)
        .returning();
      return createdEvent;
    } catch (error) {
      console.error("Error creating group event:", error);
      throw error;
    }
  }
  
  // Group Event RSVP operations
  async getRsvpsByGroupEventId(
    eventId: number
  ): Promise<(schema.GroupEventRsvp & { username: string })[]> {
    try {
      const rsvps = await db
        .select({
          ...schema.groupEventRsvps,
          username: schema.users.username,
        })
        .from(schema.groupEventRsvps)
        .innerJoin(schema.users, eq(schema.groupEventRsvps.userId, schema.users.id))
        .where(eq(schema.groupEventRsvps.eventId, eventId));
      
      return rsvps;
    } catch (error) {
      console.error(`Error fetching RSVPs for group event ${eventId}:`, error);
      return [];
    }
  }
  
  async createGroupEventRsvp(rsvp: schema.InsertGroupEventRsvp): Promise<schema.GroupEventRsvp> {
    try {
      // Get the event to find out which group it belongs to
      const [event] = await db
        .select()
        .from(schema.groupEvents)
        .where(eq(schema.groupEvents.id, rsvp.eventId));
        
      if (!event) {
        throw new Error(`Group event ${rsvp.eventId} not found`);
      }
      
      // Check if the user is a member of the group
      const isMember = await this.isUserGroupMember(rsvp.userId, event.groupId);
      if (!isMember) {
        throw new Error(`User ${rsvp.userId} is not a member of group ${event.groupId}`);
      }
      
      const [createdRsvp] = await db
        .insert(schema.groupEventRsvps)
        .values(rsvp)
        .returning();
      return createdRsvp;
    } catch (error) {
      console.error("Error creating group event RSVP:", error);
      throw error;
    }
  }
  
  async updateGroupEventRsvp(
    eventId: number,
    userId: number,
    status: string,
  ): Promise<schema.GroupEventRsvp> {
    try {
      // Get the event to find out which group it belongs to
      const [event] = await db
        .select()
        .from(schema.groupEvents)
        .where(eq(schema.groupEvents.id, eventId));
        
      if (!event) {
        throw new Error(`Group event ${eventId} not found`);
      }
      
      // Check if the user is a member of the group
      const isMember = await this.isUserGroupMember(userId, event.groupId);
      if (!isMember) {
        throw new Error(`User ${userId} is not a member of group ${event.groupId}`);
      }
      
      const [updatedRsvp] = await db
        .update(schema.groupEventRsvps)
        .set({ status })
        .where(
          and(
            eq(schema.groupEventRsvps.eventId, eventId),
            eq(schema.groupEventRsvps.userId, userId),
          ),
        )
        .returning();
    
      return updatedRsvp;
    } catch (error) {
      console.error(`Error updating RSVP for group event ${eventId} and user ${userId}:`, error);
      throw error;
    }
  }

  // Court availability operations
  async getCourtAvailability(
    facilityId: number,
    date: Date,
  ): Promise<schema.CourtAvailability[]> {
    return await db
      .select()
      .from(schema.courtAvailability)
      .where(
        and(
          eq(schema.courtAvailability.facilityId, facilityId),
          eq(schema.courtAvailability.date, date),
        ),
      )
      .orderBy(
        schema.courtAvailability.courtNumber,
        schema.courtAvailability.startTime,
      );
  }

  async updateCourtAvailability(
    id: number,
    isAvailable: boolean,
  ): Promise<schema.CourtAvailability> {
    const [updatedAvailability] = await db
      .update(schema.courtAvailability)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(schema.courtAvailability.id, id))
      .returning();

    return updatedAvailability;
  }

  /**
   * Get check-ins for a facility with usernames joined from the users table
   */
  async getCheckInsWithUsernames(
    facilityId: number,
  ): Promise<(CheckIn & { username: string; createdAt: Date })[]> {
    const checkIns = await db
      .select({
        ...schema.checkIns,
        username: schema.users.username,
      })
      .from(schema.checkIns)
      .innerJoin(schema.users, eq(schema.checkIns.userId, schema.users.id))
      .where(
        and(
          eq(schema.checkIns.facilityId, facilityId),
          gt(schema.checkIns.expiresAt, new Date()) // Only include active check-ins
        )
      )
      .orderBy(desc(schema.checkIns.createdAt))
      .limit(20); // Limit to recent check-ins

    // Make sure createdAt is properly formatted as a Date
    return checkIns.map((checkIn) => ({
      ...checkIn,
      createdAt: new Date(checkIn.createdAt),
    }));
  }
  
  /**
   * Get estimated number of people at a facility by counting active check-ins
   */
  async getEstimatedPeopleCount(facilityId: number): Promise<number> {
    // Get current check-ins count from database
    const activeCheckInsCount = await db
      .select({
        count: count(schema.checkIns.id),
      })
      .from(schema.checkIns)
      .where(
        and(
          eq(schema.checkIns.facilityId, facilityId),
          gt(schema.checkIns.expiresAt, new Date()) // Only count active check-ins
        )
      );
      
    return activeCheckInsCount[0]?.count || 0;
  }

  // Challenge operations
  async getChallenges(filters?: {
    type?: string;
    duration?: string;
    sportType?: string;
    isActive?: boolean;
    district?: string;
    query?: string;
  }): Promise<schema.Challenge[]> {
    try {
      let query = db.select().from(schema.challenges);
      
      // Build an array of conditions to apply
      const conditions = [];

      if (filters) {
        // Type filter
        if (filters.type && filters.type.trim() !== "") {
          console.log(`Filtering challenges by type: "${filters.type}"`);
          conditions.push(eq(schema.challenges.type, filters.type));
        }

        // Duration filter
        if (filters.duration && filters.duration.trim() !== "") {
          console.log(`Filtering challenges by duration: "${filters.duration}"`);
          conditions.push(eq(schema.challenges.duration, filters.duration));
        }

        // Sport type filter
        if (filters.sportType && filters.sportType.trim() !== "") {
          console.log(`Filtering challenges by sportType: "${filters.sportType}"`);
          conditions.push(eq(schema.challenges.sportType, filters.sportType));
        }

        // Active filter
        if (typeof filters.isActive === 'boolean') {
          console.log(`Filtering challenges by isActive: ${filters.isActive}`);
          conditions.push(eq(schema.challenges.isActive, filters.isActive));
        }

        // District filter
        if (filters.district && filters.district.trim() !== "") {
          console.log(`Filtering challenges by district: "${filters.district}"`);
          conditions.push(eq(schema.challenges.district, filters.district));
        }

        // Text search filter
        if (filters.query && filters.query.trim() !== "") {
          console.log(`Filtering challenges by query: "${filters.query}"`);
          conditions.push(
            or(
              sql`${schema.challenges.name} ILIKE ${`%${filters.query}%`}`,
              sql`${schema.challenges.description} ILIKE ${`%${filters.query}%`}`
            )
          );
        }
      }

      // If we have conditions, apply them
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          query = query.where(conditions[0]);
        } else {
          query = query.where(and(...conditions));
        }
      }

      // Only show current or upcoming challenges by default
      if (!conditions.find(c => c.toString().includes('endDate'))) {
        query = query.where(
          or(
            gt(schema.challenges.endDate, new Date()),
            eq(schema.challenges.isActive, true)
          )
        );
      }

      // Order by start date (newest first)
      query = query.orderBy(desc(schema.challenges.startDate));

      const challenges = await query;
      console.log(`Found ${challenges.length} challenges with filters:`, filters);
      return challenges;
    } catch (error) {
      console.error("Database error fetching challenges:", error);
      return [];
    }
  }

  async getChallenge(id: number): Promise<schema.Challenge | undefined> {
    try {
      const [challenge] = await db
        .select()
        .from(schema.challenges)
        .where(eq(schema.challenges.id, id));
      return challenge;
    } catch (error) {
      console.error(`Error fetching challenge with ID ${id}:`, error);
      return undefined;
    }
  }

  async createChallenge(challenge: schema.InsertChallenge): Promise<schema.Challenge> {
    try {
      const [createdChallenge] = await db
        .insert(schema.challenges)
        .values(challenge)
        .returning();
      
      return createdChallenge;
    } catch (error) {
      console.error("Error creating challenge:", error);
      throw error;
    }
  }

  async updateChallenge(id: number, challengeData: Partial<schema.Challenge>): Promise<schema.Challenge | undefined> {
    try {
      console.log(`Updating challenge ${id} with data:`, challengeData);
      
      // Validate that challenge exists first
      const existingChallenge = await this.getChallenge(id);
      if (!existingChallenge) {
        console.log(`Challenge with ID ${id} not found for update`);
        return undefined;
      }
      
      // Update the challenge
      const [updatedChallenge] = await db
        .update(schema.challenges)
        .set({
          ...challengeData,
          // Don't allow updating certain fields
          id: undefined,
          createdAt: undefined,
        })
        .where(eq(schema.challenges.id, id))
        .returning();
      
      console.log(`Challenge ${id} updated successfully`);
      return updatedChallenge;
    } catch (error) {
      console.error(`Error updating challenge ${id}:`, error);
      throw error;
    }
  }

  async deleteChallenge(id: number): Promise<void> {
    try {
      // First get the challenge to make sure it exists
      const challenge = await this.getChallenge(id);
      if (!challenge) {
        throw new Error(`Challenge with ID ${id} not found`);
      }
      
      // Delete all user challenges (participations) for this challenge
      await db
        .delete(schema.userChallenges)
        .where(eq(schema.userChallenges.challengeId, id));
      
      // Delete the challenge
      await db
        .delete(schema.challenges)
        .where(eq(schema.challenges.id, id));
      
      console.log(`Challenge ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting challenge ${id}:`, error);
      throw error;
    }
  }

  // User Challenge operations
  async getUserChallenges(userId: number): Promise<(schema.UserChallenge & { challenge: schema.Challenge })[]> {
    try {
      const userChallenges = await db
        .select({
          userId: schema.userChallenges.userId,
          challengeId: schema.userChallenges.challengeId,
          joinedAt: schema.userChallenges.joinedAt,
          currentValue: schema.userChallenges.currentValue,
          completed: schema.userChallenges.completed,
          completedAt: schema.userChallenges.completedAt,
          lastUpdated: schema.userChallenges.lastUpdated,
          challenge: schema.challenges,
        })
        .from(schema.userChallenges)
        .innerJoin(
          schema.challenges,
          eq(schema.userChallenges.challengeId, schema.challenges.id)
        )
        .where(eq(schema.userChallenges.userId, userId))
        .orderBy(
          desc(schema.challenges.endDate), 
          desc(schema.userChallenges.lastUpdated)
        );
      
      return userChallenges;
    } catch (error) {
      console.error(`Error fetching challenges for user ${userId}:`, error);
      return [];
    }
  }

  async getUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge | undefined> {
    try {
      const [userChallenge] = await db
        .select()
        .from(schema.userChallenges)
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        );
      return userChallenge;
    } catch (error) {
      console.error(`Error fetching user challenge for user ${userId} and challenge ${challengeId}:`, error);
      return undefined;
    }
  }

  async joinChallenge(userChallenge: schema.InsertUserChallenge): Promise<schema.UserChallenge> {
    try {
      const { userId, challengeId } = userChallenge;
      
      // Check if user is already joined
      const existing = await this.getUserChallenge(userId, challengeId);
      if (existing) {
        console.log(`User ${userId} already joined challenge ${challengeId}`);
        return existing;
      }
      
      // Join the challenge
      const [joinedChallenge] = await db
        .insert(schema.userChallenges)
        .values(userChallenge)
        .returning();
      
      console.log(`User ${userId} joined challenge ${challengeId}`);
      return joinedChallenge;
    } catch (error) {
      console.error(`Error joining challenge:`, error);
      throw error;
    }
  }

  async updateUserChallengeProgress(userId: number, challengeId: number, currentValue: number): Promise<schema.UserChallenge> {
    try {
      // First check if user challenge exists
      const userChallenge = await this.getUserChallenge(userId, challengeId);
      if (!userChallenge) {
        throw new Error(`User ${userId} has not joined challenge ${challengeId}`);
      }
      
      // Get challenge target value
      const challenge = await this.getChallenge(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }
      
      // Check if completed
      const completed = currentValue >= challenge.targetValue;
      const completedDate = completed && !userChallenge.completed ? new Date() : userChallenge.completedAt;
      
      // Update progress
      const [updatedUserChallenge] = await db
        .update(schema.userChallenges)
        .set({
          currentValue,
          completed,
          completedAt: completedDate,
          lastUpdated: new Date(),
        })
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        )
        .returning();
      
      // If newly completed, create achievement if configured
      if (completed && !userChallenge.completed && challenge.achievementId) {
        console.log(`User ${userId} completed challenge ${challengeId} - awarding achievement ${challenge.achievementId}`);
        try {
          await this.awardUserAchievement(userId, challenge.achievementId);
        } catch (err) {
          console.error(`Error awarding achievement:`, err);
          // Don't fail the operation if achievement award fails
        }
      }
      
      return updatedUserChallenge;
    } catch (error) {
      console.error(`Error updating user challenge progress:`, error);
      throw error;
    }
  }

  async completeUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge> {
    try {
      // First check if user challenge exists
      const userChallenge = await this.getUserChallenge(userId, challengeId);
      if (!userChallenge) {
        throw new Error(`User ${userId} has not joined challenge ${challengeId}`);
      }
      
      // Get challenge
      const challenge = await this.getChallenge(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }
      
      // Mark as completed
      const [completedUserChallenge] = await db
        .update(schema.userChallenges)
        .set({
          currentValue: challenge.targetValue, // Set to target value
          completed: true,
          completedAt: new Date(),
          lastUpdated: new Date(),
        })
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        )
        .returning();
      
      // Award achievement if configured
      if (challenge.achievementId) {
        console.log(`User ${userId} completed challenge ${challengeId} - awarding achievement ${challenge.achievementId}`);
        try {
          await this.awardUserAchievement(userId, challenge.achievementId);
        } catch (err) {
          console.error(`Error awarding achievement:`, err);
          // Don't fail the operation if achievement award fails
        }
      }
      
      return completedUserChallenge;
    } catch (error) {
      console.error(`Error completing user challenge:`, error);
      throw error;
    }
  }

  // Achievement operations
  async getAchievements(): Promise<schema.Achievement[]> {
    try {
      const achievements = await db
        .select()
        .from(schema.achievements)
        .where(eq(schema.achievements.isActive, true))
        .orderBy(schema.achievements.category, schema.achievements.level);
      
      return achievements;
    } catch (error) {
      console.error("Error fetching achievements:", error);
      return [];
    }
  }

  async getUserAchievements(userId: number): Promise<(schema.UserAchievement & { achievement: schema.Achievement })[]> {
    try {
      const userAchievements = await db
        .select({
          userId: schema.userAchievements.userId,
          achievementId: schema.userAchievements.achievementId,
          earnedAt: schema.userAchievements.earnedAt,
          progress: schema.userAchievements.progress,
          completed: schema.userAchievements.completed,
          achievement: schema.achievements,
        })
        .from(schema.userAchievements)
        .innerJoin(
          schema.achievements,
          eq(schema.userAchievements.achievementId, schema.achievements.id)
        )
        .where(eq(schema.userAchievements.userId, userId))
        .orderBy(schema.userAchievements.earnedAt);
      
      return userAchievements;
    } catch (error) {
      console.error(`Error fetching achievements for user ${userId}:`, error);
      return [];
    }
  }

  // Helper method to award achievement to user
  private async awardUserAchievement(userId: number, achievementId: number): Promise<void> {
    try {
      // Check if user already has this achievement
      const [existingAchievement] = await db
        .select()
        .from(schema.userAchievements)
        .where(
          and(
            eq(schema.userAchievements.userId, userId),
            eq(schema.userAchievements.achievementId, achievementId)
          )
        );
      
      if (existingAchievement) {
        if (!existingAchievement.completed) {
          // If they have it but not completed, mark as completed
          await db
            .update(schema.userAchievements)
            .set({
              completed: true,
              earnedAt: new Date(),
            })
            .where(
              and(
                eq(schema.userAchievements.userId, userId),
                eq(schema.userAchievements.achievementId, achievementId)
              )
            );
          console.log(`Updated existing achievement ${achievementId} for user ${userId} to completed`);
        } else {
          console.log(`User ${userId} already has completed achievement ${achievementId}`);
        }
        return;
      }
      
      // Award new achievement
      await db
        .insert(schema.userAchievements)
        .values({
          userId,
          achievementId,
          progress: 100, // Set to 100% since we're directly awarding it
          completed: true,
        });
      
      console.log(`Awarded achievement ${achievementId} to user ${userId}`);
    } catch (error) {
      console.error(`Error awarding achievement ${achievementId} to user ${userId}:`, error);
      throw error;
    }
  }

  // Challenge operations implementation
  async getChallenges(filters?: {
    type?: string;
    duration?: string;
    sportType?: string;
    isActive?: boolean;
    district?: string;
    query?: string;
    groupId?: number;   // Optional group ID to filter group-specific challenges
    isPublic?: boolean; // If true, only show app-wide challenges; if false, only show group-specific
    userId?: number;    // Required to verify group membership for private group challenges
  }): Promise<schema.Challenge[]> {
    try {
      let query = db.select().from(schema.challenges);
      
      // Build an array of conditions to apply
      const conditions = [];

      if (filters) {
        // Type filter
        if (filters.type && filters.type.trim() !== "") {
          conditions.push(sql`${schema.challenges.type} = ${filters.type}`);
        }

        // Duration filter
        if (filters.duration && filters.duration.trim() !== "") {
          conditions.push(sql`${schema.challenges.duration} = ${filters.duration}`);
        }

        // Sport type filter
        if (filters.sportType && filters.sportType.trim() !== "") {
          conditions.push(sql`${schema.challenges.sportType} = ${filters.sportType}`);
        }

        // District filter
        if (filters.district && filters.district.trim() !== "") {
          conditions.push(sql`${schema.challenges.district} = ${filters.district}`);
        }

        // Active status filter
        if (filters.isActive !== undefined) {
          conditions.push(sql`${schema.challenges.isActive} = ${filters.isActive}`);
        }

        // Text search filter - query name and description
        if (filters.query && filters.query.trim() !== "") {
          conditions.push(
            or(
              sql`${schema.challenges.name} ILIKE ${`%${filters.query}%`}`,
              sql`${schema.challenges.description} ILIKE ${`%${filters.query}%`}`
            )
          );
        }

        // Group filter - specific to a group
        if (filters.groupId) {
          conditions.push(sql`${schema.challenges.groupId} = ${filters.groupId}`);
          
          // If user ID is provided, verify they have access to this group's challenges
          if (filters.userId) {
            // Check if user is a member of the group
            const isMember = await this.isUserGroupMember(filters.userId, filters.groupId);
            if (!isMember) {
              // If not a member, return empty array
              return [];
            }
          }
        }

        // Public/Private filter
        if (filters.isPublic !== undefined) {
          if (filters.isPublic) {
            // Only show app-wide challenges (isPublic = true)
            conditions.push(sql`${schema.challenges.isPublic} = true`);
          } else {
            // Only show group-specific challenges (isPublic = false)
            conditions.push(sql`${schema.challenges.isPublic} = false`);
          }
        }
      }

      // By default, show only public challenges if no isPublic or groupId filter is provided
      if (filters?.isPublic === undefined && !filters?.groupId) {
        conditions.push(sql`${schema.challenges.isPublic} = true`);
      }

      // Apply all conditions if any exist
      if (conditions.length > 0) {
        if (conditions.length === 1) {
          query = query.where(conditions[0]);
        } else {
          query = query.where(and(...conditions));
        }
      }

      const challenges = await query;
      return challenges;
    } catch (error) {
      console.error("Error fetching challenges:", error);
      return [];
    }
  }

  async getChallenge(id: number, userId?: number): Promise<schema.Challenge | undefined> {
    try {
      const [challenge] = await db
        .select()
        .from(schema.challenges)
        .where(eq(schema.challenges.id, id));
      
      if (!challenge) {
        return undefined;
      }
      
      // If it's a public challenge, return it regardless of user
      if (challenge.isPublic) {
        return challenge;
      }
      
      // If it's a private group challenge, check user membership
      if (!challenge.isPublic && challenge.groupId) {
        // If no userId is provided, don't return private challenge
        if (!userId) {
          return undefined;
        }
        
        // Check if user is a member of the group
        const isMember = await this.isUserGroupMember(userId, challenge.groupId);
        if (!isMember) {
          return undefined; // User doesn't have access to this group challenge
        }
      }
      
      return challenge;
    } catch (error) {
      console.error(`Error fetching challenge with ID ${id}:`, error);
      return undefined;
    }
  }

  async createChallenge(challenge: schema.InsertChallenge): Promise<schema.Challenge> {
    try {
      const [createdChallenge] = await db
        .insert(schema.challenges)
        .values(challenge)
        .returning();
      
      return createdChallenge;
    } catch (error) {
      console.error("Error creating challenge:", error);
      throw error;
    }
  }

  async updateChallenge(id: number, challengeData: Partial<schema.Challenge>): Promise<schema.Challenge | undefined> {
    try {
      console.log(`Updating challenge ${id} with data:`, challengeData);
      
      // Validate that challenge exists first
      const existingChallenge = await this.getChallenge(id);
      if (!existingChallenge) {
        console.log(`Challenge with ID ${id} not found for update`);
        return undefined;
      }
      
      // Update the challenge
      const [updatedChallenge] = await db
        .update(schema.challenges)
        .set({
          ...challengeData,
          // Don't allow updating certain fields
          id: undefined,
          createdAt: undefined,
          createdBy: undefined,
        })
        .where(eq(schema.challenges.id, id))
        .returning();
      
      console.log(`Challenge ${id} updated successfully`);
      return updatedChallenge;
    } catch (error) {
      console.error(`Error updating challenge ${id}:`, error);
      throw error;
    }
  }

  async deleteChallenge(id: number): Promise<void> {
    try {
      // Delete related user challenge entries first
      await db
        .delete(schema.userChallenges)
        .where(eq(schema.userChallenges.challengeId, id));
      
      // Then delete the challenge
      await db
        .delete(schema.challenges)
        .where(eq(schema.challenges.id, id));
      
      console.log(`Challenge ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting challenge ${id}:`, error);
      throw error;
    }
  }

  // User Challenge operations implementation
  async getUserChallenges(userId: number): Promise<(schema.UserChallenge & { challenge: schema.Challenge })[]> {
    try {
      const userChallenges = await db
        .select({
          userId: schema.userChallenges.userId,
          challengeId: schema.userChallenges.challengeId,
          joinedAt: schema.userChallenges.joinedAt,
          currentValue: schema.userChallenges.currentValue,
          completed: schema.userChallenges.completed,
          completedAt: schema.userChallenges.completedAt,
          lastUpdated: schema.userChallenges.lastUpdated,
          challenge: schema.challenges,
        })
        .from(schema.userChallenges)
        .innerJoin(
          schema.challenges,
          eq(schema.userChallenges.challengeId, schema.challenges.id)
        )
        .where(eq(schema.userChallenges.userId, userId));
      
      return userChallenges;
    } catch (error) {
      console.error(`Error fetching challenges for user ${userId}:`, error);
      return [];
    }
  }

  async getUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge | undefined> {
    try {
      const [userChallenge] = await db
        .select()
        .from(schema.userChallenges)
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        );
      
      return userChallenge;
    } catch (error) {
      console.error(`Error fetching user challenge for user ${userId}, challenge ${challengeId}:`, error);
      return undefined;
    }
  }

  async joinChallenge(userChallenge: schema.InsertUserChallenge): Promise<schema.UserChallenge> {
    try {
      const [createdUserChallenge] = await db
        .insert(schema.userChallenges)
        .values(userChallenge)
        .returning();
      
      return createdUserChallenge;
    } catch (error) {
      console.error("Error joining challenge:", error);
      throw error;
    }
  }

  async updateUserChallengeProgress(userId: number, challengeId: number, currentValue: number): Promise<schema.UserChallenge> {
    try {
      // Get the existing user challenge
      const existingUserChallenge = await this.getUserChallenge(userId, challengeId);
      if (!existingUserChallenge) {
        throw new Error(`User ${userId} has not joined challenge ${challengeId}`);
      }
      
      // Get the challenge to check if the target is reached
      const challenge = await this.getChallenge(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }
      
      // Determine if the challenge is now completed
      const isCompleted = currentValue >= challenge.targetValue;
      
      // Update the user challenge
      const [updatedUserChallenge] = await db
        .update(schema.userChallenges)
        .set({
          currentValue,
          completed: isCompleted,
          completedAt: isCompleted ? new Date() : undefined,
          lastUpdated: new Date()
        })
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        )
        .returning();
      
      return updatedUserChallenge;
    } catch (error) {
      console.error(`Error updating progress for user ${userId}, challenge ${challengeId}:`, error);
      throw error;
    }
  }

  async completeUserChallenge(userId: number, challengeId: number): Promise<schema.UserChallenge> {
    try {
      // Get the challenge to check if there's an associated achievement
      const challenge = await this.getChallenge(challengeId);
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }
      
      // Mark the challenge as completed
      const [updatedUserChallenge] = await db
        .update(schema.userChallenges)
        .set({
          completed: true,
          completedAt: new Date(),
          lastUpdated: new Date()
        })
        .where(
          and(
            eq(schema.userChallenges.userId, userId),
            eq(schema.userChallenges.challengeId, challengeId)
          )
        )
        .returning();
      
      // Award any associated achievement if challenge is linked to one
      if (challenge.achievementId) {
        try {
          await this.awardUserAchievement(userId, challenge.achievementId);
        } catch (error) {
          console.error(`Error awarding achievement to user ${userId}:`, error);
          // Continue with challenge completion even if achievement award fails
        }
      }
      
      return updatedUserChallenge;
    } catch (error) {
      console.error(`Error completing challenge for user ${userId}, challenge ${challengeId}:`, error);
      throw error;
    }
  }
}

// Export an instance of the storage
export const storage = new DatabaseStorage();
