import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  doublePrecision,
  time,
  varchar,
  primaryKey,
  json,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums and constants
// Facility types enum
export const facilityTypes = [
  "basketball",
  "soccer",
  "tennis",
  "badminton",
  "swimming",
  "running",
  "fitness",
  "sports_ground",
  "sports_centre",
  "other",
] as const;

// Approval status enum
export const approvalStatuses = ["pending", "approved", "rejected"] as const;

// Districts in Hong Kong
export const districts = [
  "central",
  "eastern",
  "southern",
  "wanchai",
  "kowloon_city",
  "kwun_tong",
  "sham_shui_po",
  "wong_tai_sin",
  "yau_tsim_mong",
  "islands",
  "kwai_tsing",
  "north",
  "sai_kung",
  "sha_tin",
  "tai_po",
  "tsuen_wan",
  "tuen_mun",
  "yuen_long",
] as const;

// Skill levels enum
export const skillLevels = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "all_levels",
] as const;

// RSVP status enum
export const rsvpStatuses = ["going", "interested", "declined"] as const;

// Connection status enum
export const connectionStatuses = ["pending", "accepted", "rejected"] as const;

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  // Additional profile fields
  preferredSports: text("preferred_sports").array(),
  skillLevel: json("skill_level"), // JSON object mapping sport name to skill level
  preferredLocations: text("preferred_locations").array(),
  bio: text("bio"),
  phoneNumber: text("phone_number"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  email: true,
  preferredSports: true,
  skillLevel: true,
  preferredLocations: true,
  bio: true,
  phoneNumber: true,
  isAdmin: true,
});

// Facilities table
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().$type<(typeof facilityTypes)[number]>(),
  district: text("district").notNull().$type<(typeof districts)[number]>(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  openTime: time("open_time"),
  closeTime: time("close_time"),
  contactPhone: text("contact_phone"),
  imageUrl: text("image_url"),
  courts: integer("courts"),
  amenities: json("amenities").$type<string[]>(),
  ageRestriction: text("age_restriction"),
  genderSuitability: text("gender_suitability"),
  createdAt: timestamp("created_at").defaultNow(),
  // Rating fields
  averageRating: doublePrecision("average_rating"),
  totalReviews: integer("total_reviews").default(0),
  // Web search integration fields
  approvalStatus: text("approval_status")
    .$type<(typeof approvalStatuses)[number]>()
    .default("approved"),
  searchSource: text("search_source"),
});

export const insertFacilitySchema = createInsertSchema(facilities).omit({
  id: true,
  createdAt: true,
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  facilityId: integer("facility_id")
    .notNull()
    .references(() => facilities.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

// Check-ins table
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  facilityId: integer("facility_id")
    .notNull()
    .references(() => facilities.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Expiration timestamp
});

export const insertCheckInSchema = createInsertSchema(checkIns).omit({
  id: true,
  createdAt: true,
});

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  facilityId: integer("facility_id").references(() => facilities.id),
  eventDate: date("event_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  sportType: text("sport_type").$type<(typeof facilityTypes)[number]>(),
  skillLevel: text("skill_level").$type<(typeof skillLevels)[number]>(),
  maxParticipants: integer("max_participants"),
  isOfficial: boolean("is_official").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  organizerId: integer("organizer_id").references(() => users.id),
  // Group association
  groupId: integer("group_id").references(() => groups.id),
  // Web search integration fields
  approvalStatus: text("approval_status")
    .$type<(typeof approvalStatuses)[number]>()
    .default("approved"),
  searchSource: text("search_source"),
  // External data fields
  website: text("website"),
  imageUrl: text("image_url"),
  location: json("location").$type<{
    name: string;
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    }
  }>(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

// Group Events table (separate from public events)
export const groupEvents = pgTable("group_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // Using locationName and address directly instead of facility_id based on migration schema
  locationName: text("location_name").notNull(),
  address: text("address"),
  eventDate: date("event_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  sportType: text("sport_type").notNull().$type<(typeof facilityTypes)[number]>(),
  skillLevel: text("skill_level").notNull().$type<(typeof skillLevels)[number]>(),
  maxParticipants: integer("max_participants"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  organizerId: integer("organizer_id").notNull().references(() => users.id),
  // Group association (required for group events)
  groupId: integer("group_id").notNull().references(() => groups.id),
});

export const insertGroupEventSchema = createInsertSchema(groupEvents).omit({
  id: true,
  createdAt: true,
});

// Group Event RSVPs table
export const groupEventRsvps = pgTable(
  "group_event_rsvps",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => groupEvents.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().$type<"going" | "not_going" | "maybe">(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey(table.eventId, table.userId),
    };
  }
);

export const insertGroupEventRsvpSchema = createInsertSchema(groupEventRsvps).omit({
  createdAt: true,
});

// Event RSVPs table
export const eventRsvps = pgTable(
  "event_rsvps",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().$type<(typeof rsvpStatuses)[number]>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey(t.eventId, t.userId),
  }),
);

export const insertEventRsvpSchema = createInsertSchema(eventRsvps).omit({
  createdAt: true,
});

// Routes table for running and cycling paths
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  district: text("district").$type<(typeof districts)[number]>(),
  distance: doublePrecision("distance"), // in kilometers
  difficulty: text("difficulty"),
  pathCoordinates: json("path_coordinates").$type<Array<[number, number]>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
});

// Court availability table
export const courtAvailability = pgTable("court_availability", {
  id: serial("id").primaryKey(),
  facilityId: integer("facility_id")
    .notNull()
    .references(() => facilities.id),
  courtNumber: integer("court_number").notNull(),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCourtAvailabilitySchema = createInsertSchema(
  courtAvailability,
).omit({
  id: true,
  updatedAt: true,
});

// Community Tables

// Groups table
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sportType: text("sport_type").$type<(typeof facilityTypes)[number]>(),
  createdAt: timestamp("created_at").defaultNow(),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => users.id),
  imageUrl: text("image_url"),
  district: text("district").$type<(typeof districts)[number]>(),
  isPrivate: boolean("is_private").default(false),
  memberCount: integer("member_count").default(0),
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  memberCount: true,
});

// Group members table
export const membershipStatuses = ["pending", "approved", "rejected"] as const;

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp("joined_at").defaultNow(),
    role: text("role").default("member").$type<"admin" | "moderator" | "member">(),
    status: text("status").default("approved").$type<(typeof membershipStatuses)[number]>(),
  },
  (t) => ({
    pk: primaryKey(t.groupId, t.userId),
  }),
);

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  joinedAt: true,
});

// Posts table
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  facilityId: integer("facility_id").references(() => facilities.id),
  eventId: integer("event_id").references(() => events.id),
  sportType: text("sport_type").$type<(typeof facilityTypes)[number]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  isPublic: boolean("is_public").default(true),
  groupId: integer("group_id").references(() => groups.id),
  likes: integer("likes").default(0),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likes: true,
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  likes: integer("likes").default(0),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  likes: true,
});

// Connections table
export const connections = pgTable(
  "connections",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    connectedUserId: integer("connected_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status")
      .notNull()
      .$type<(typeof connectionStatuses)[number]>()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at"),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.connectedUserId),
  }),
);

export const insertConnectionSchema = createInsertSchema(connections).omit({
  createdAt: true,
  updatedAt: true,
});

// Post likes table
export const postLikes = pgTable(
  "post_likes",
  {
    id: serial("id"),  // Remove primaryKey() here
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userPostIdx: primaryKey({ columns: [table.userId, table.postId] }),
  }),
);

export const insertPostLikeSchema = createInsertSchema(postLikes).omit({
  id: true,
  createdAt: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  checkIns: many(checkIns),
  eventRsvps: many(eventRsvps),
  groupEventRsvps: many(groupEventRsvps),
  posts: many(posts),
  groupMemberships: many(groupMembers),
  connections: many(connections, { relationName: "userConnections" }),
  receivedConnections: many(connections, { relationName: "receivedConnections" }),
}));

export const facilitiesRelations = relations(facilities, ({ many }) => ({
  reviews: many(reviews),
  checkIns: many(checkIns),
  events: many(events),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [reviews.facilityId],
    references: [facilities.id],
  }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  user: one(users, {
    fields: [checkIns.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [checkIns.facilityId],
    references: [facilities.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [events.facilityId],
    references: [facilities.id],
  }),
  organizer: one(users, {
    fields: [events.organizerId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [events.groupId],
    references: [groups.id],
  }),
  rsvps: many(eventRsvps),
}));

export const eventRsvpsRelations = relations(eventRsvps, ({ one }) => ({
  event: one(events, {
    fields: [eventRsvps.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRsvps.userId],
    references: [users.id],
  }),
}));

export const groupEventsRelations = relations(groupEvents, ({ one, many }) => ({
  organizer: one(users, {
    fields: [groupEvents.organizerId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [groupEvents.groupId],
    references: [groups.id],
  }),
  rsvps: many(groupEventRsvps),
}));

export const groupEventRsvpsRelations = relations(groupEventRsvps, ({ one }) => ({
  event: one(groupEvents, {
    fields: [groupEventRsvps.eventId],
    references: [groupEvents.id],
  }),
  user: one(users, {
    fields: [groupEventRsvps.userId],
    references: [users.id],
  }),
}));

export const courtAvailabilityRelations = relations(
  courtAvailability,
  ({ one }) => ({
    facility: one(facilities, {
      fields: [courtAvailability.facilityId],
      references: [facilities.id],
    }),
  }),
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.creatorId],
    references: [users.id],
  }),
  members: many(groupMembers),
  posts: many(posts),
  groupEvents: many(groupEvents),
  challenges: many(challenges),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  facility: one(facilities, {
    fields: [posts.facilityId],
    references: [facilities.id],
  }),
  event: one(events, {
    fields: [posts.eventId],
    references: [events.id],
  }),
  group: one(groups, {
    fields: [posts.groupId],
    references: [groups.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id],
    relationName: "userConnections",
  }),
  connectedUser: one(users, {
    fields: [connections.connectedUserId],
    references: [users.id],
    relationName: "receivedConnections",
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type CheckIn = typeof checkIns.$inferSelect;
export type InsertCheckIn = z.infer<typeof insertCheckInSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type EventRsvp = typeof eventRsvps.$inferSelect;
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;

export type GroupEvent = typeof groupEvents.$inferSelect;
export type InsertGroupEvent = z.infer<typeof insertGroupEventSchema>;

export type GroupEventRsvp = typeof groupEventRsvps.$inferSelect;
export type InsertGroupEventRsvp = z.infer<typeof insertGroupEventRsvpSchema>;

export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

export type CourtAvailability = typeof courtAvailability.$inferSelect;
export type InsertCourtAvailability = z.infer<
  typeof insertCourtAvailabilitySchema
>;

export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

// Messages table for real-time chat
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;

// Achievement categories enum
export const achievementCategories = [
  "check_in", 
  "review", 
  "event", 
  "social", 
  "group", 
  "post", 
  "connection",
  "milestone",
  "challenge" // Added challenge category for achievements earned through challenges
] as const;

// Challenge types enum
export const challengeTypes = [
  "check_in",
  "activity",
  "event_participation",
  "social",
  "review",
  "facility_exploration",
  "consistency"
] as const;

// Challenge durations enum
export const challengeDurations = [
  "daily",
  "weekly",
  "monthly",
  "seasonal"
] as const;

// Achievements table
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().$type<(typeof achievementCategories)[number]>(),
  points: integer("points").notNull().default(10),
  badgeUrl: text("badge_url"),
  requirement: integer("requirement").notNull(), // Number required to earn (e.g., 5 check-ins)
  level: integer("level").notNull().default(1), // Higher levels for tiered achievements
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

// User Achievements table - tracks earned achievements
export const userAchievements = pgTable(
  "user_achievements",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id),
    earnedAt: timestamp("earned_at").defaultNow(),
    progress: integer("progress").notNull().default(0), // Track progress toward achievement
    completed: boolean("completed").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.achievementId),
  }),
);

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  earnedAt: true,
});

// Achievement relations
export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

// Correctly update the users relations with achievements
export const usersRelationsWithAchievements = relations(users, ({ many }) => ({
  reviews: many(reviews),
  checkIns: many(checkIns),
  eventRsvps: many(eventRsvps),
  groupEventRsvps: many(groupEventRsvps),
  posts: many(posts),
  groupMemberships: many(groupMembers),
  connections: many(connections, { relationName: "userConnections" }),
  receivedConnections: many(connections, { relationName: "receivedConnections" }),
  achievements: many(userAchievements),
}));

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

// Challenges table - community challenge system
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull().$type<(typeof challengeTypes)[number]>(),
  duration: text("duration").notNull().$type<(typeof challengeDurations)[number]>(),
  targetValue: integer("target_value").notNull(), // Target value to complete (e.g., 10 check-ins)
  points: integer("points").notNull().default(50), // Points awarded for completion
  badgeUrl: text("badge_url"),
  startDate: date("start_date").notNull(), // When the challenge starts
  endDate: date("end_date").notNull(), // When the challenge ends
  sportType: text("sport_type").$type<(typeof facilityTypes)[number]>(), // Optional sport type filter
  district: text("district").$type<(typeof districts)[number]>(), // Optional district filter
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id), // Admin who created the challenge
  isActive: boolean("is_active").default(true),
  achievementId: integer("achievement_id").references(() => achievements.id), // Link to achievement earned by completing
  groupId: integer("group_id").references(() => groups.id), // Optional group ID for group-specific challenges (null = app-wide)
  isPublic: boolean("is_public").default(true), // If true, challenge is app-wide; if false, group-specific
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
});

// User Challenges table - tracks user participation in challenges
export const userChallenges = pgTable(
  "user_challenges",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challenges.id),
    joinedAt: timestamp("joined_at").defaultNow(),
    currentValue: integer("current_value").notNull().default(0), // Current progress value
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at"), // When the user completed the challenge
    lastUpdated: timestamp("last_updated").defaultNow(),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.challengeId),
  }),
);

export const insertUserChallengeSchema = createInsertSchema(userChallenges).omit({
  joinedAt: true,
  lastUpdated: true,
  completedAt: true,
});

// Challenge relations
export const challengesRelations = relations(challenges, ({ one, many }) => ({
  creator: one(users, {
    fields: [challenges.createdBy],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [challenges.achievementId],
    references: [achievements.id],
  }),
  group: one(groups, {
    fields: [challenges.groupId],
    references: [groups.id],
  }),
  userChallenges: many(userChallenges),
}));

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
  user: one(users, {
    fields: [userChallenges.userId],
    references: [users.id],
  }),
  challenge: one(challenges, {
    fields: [userChallenges.challengeId],
    references: [challenges.id],
  }),
}));

// Update users relations with challenges
export const usersRelationsWithChallenges = relations(users, ({ many }) => ({
  reviews: many(reviews),
  checkIns: many(checkIns),
  eventRsvps: many(eventRsvps),
  groupEventRsvps: many(groupEventRsvps),
  posts: many(posts),
  groupMemberships: many(groupMembers),
  connections: many(connections, { relationName: "userConnections" }),
  receivedConnections: many(connections, { relationName: "receivedConnections" }),
  achievements: many(userAchievements),
  challenges: many(userChallenges),
  createdChallenges: many(challenges, { relationName: "challengeCreator" }),
}));

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;