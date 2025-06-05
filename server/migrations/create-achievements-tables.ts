import { db } from "../db";
import { sql } from "drizzle-orm";
import { achievements, userAchievements } from "@shared/schema";

/**
 * Script to create the tables needed for the achievements system
 */
export async function createAchievementsTables() {
  console.log("[migration] Starting migration to create achievements tables");

  // Check if the tables already exist
  const tablesExist = await checkTablesExist();
  
  // Create the achievements table if it doesn't exist
  if (!tablesExist.achievements) {
    console.log("[migration] Creating achievements table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 10,
        badge_url TEXT,
        requirement INTEGER NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("[migration] Achievements table created successfully");
  } else {
    console.log("[migration] Achievements table already exists, skipping creation");
  }

  // Create the user_achievements table if it doesn't exist
  if (!tablesExist.userAchievements) {
    console.log("[migration] Creating user_achievements table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_achievements (
        user_id INTEGER NOT NULL REFERENCES users(id),
        achievement_id INTEGER NOT NULL REFERENCES achievements(id),
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        progress INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (user_id, achievement_id)
      )
    `);
    console.log("[migration] User achievements table created successfully");
  } else {
    console.log("[migration] User achievements table already exists, skipping creation");
  }

  console.log("[migration] Achievements tables migration completed");
  return { success: true };
}

// Helper function to check if the tables already exist
async function checkTablesExist() {
  // Check if the achievements table exists
  const achievementsTableExists = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'achievements'
    )
  `);

  // Check if the user_achievements table exists
  const userAchievementsTableExists = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_achievements'
    )
  `);

  return {
    achievements: achievementsTableExists.rows[0].exists,
    userAchievements: userAchievementsTableExists.rows[0].exists
  };
}

// Seed initial achievements
export async function seedAchievements() {
  console.log("[migration] Checking if achievements data needs to be seeded");
  
  // Check if achievements already exist
  const existingAchievements = await db.select().from(achievements);
  
  if (existingAchievements.length > 0) {
    console.log(`[migration] ${existingAchievements.length} achievements already exist, skipping seeding`);
    return;
  }
  
  console.log("[migration] Seeding initial achievements data");

  // Define initial achievements
  const initialAchievements = [
    // Check-in achievements
    {
      name: "First Check-in",
      description: "Check in to your first sports facility",
      category: "check_in",
      points: 10,
      badgeUrl: "/achievements/first-checkin.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Regular Visitor",
      description: "Check in to any facility 5 times",
      category: "check_in",
      points: 20,
      badgeUrl: "/achievements/regular-visitor.svg",
      requirement: 5,
      level: 1,
      isActive: true
    },
    {
      name: "Facility Explorer",
      description: "Check in to 5 different facilities",
      category: "check_in",
      points: 30,
      badgeUrl: "/achievements/facility-explorer.svg",
      requirement: 5,
      level: 1,
      isActive: true
    },
    
    // Review achievements
    {
      name: "First Review",
      description: "Write your first facility review",
      category: "review",
      points: 15,
      badgeUrl: "/achievements/first-review.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Helpful Reviewer",
      description: "Write 5 facility reviews",
      category: "review",
      points: 25,
      badgeUrl: "/achievements/helpful-reviewer.svg",
      requirement: 5,
      level: 1,
      isActive: true
    },
    
    // Event achievements
    {
      name: "Event Participant",
      description: "Join your first sports event",
      category: "event",
      points: 15,
      badgeUrl: "/achievements/event-participant.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Event Organizer",
      description: "Create your first sports event",
      category: "event",
      points: 20,
      badgeUrl: "/achievements/event-organizer.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    
    // Social achievements
    {
      name: "Social Butterfly",
      description: "Make your first connection with another user",
      category: "social",
      points: 10,
      badgeUrl: "/achievements/social-butterfly.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Network Builder",
      description: "Connect with 5 other users",
      category: "social",
      points: 30,
      badgeUrl: "/achievements/network-builder.svg",
      requirement: 5,
      level: 1,
      isActive: true
    },
    
    // Group achievements
    {
      name: "Group Joiner",
      description: "Join your first sports group",
      category: "group",
      points: 15,
      badgeUrl: "/achievements/group-joiner.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Group Creator",
      description: "Create your first sports group",
      category: "group",
      points: 25,
      badgeUrl: "/achievements/group-creator.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    
    // Post achievements
    {
      name: "First Post",
      description: "Create your first post",
      category: "post",
      points: 10,
      badgeUrl: "/achievements/first-post.svg",
      requirement: 1,
      level: 1,
      isActive: true
    },
    {
      name: "Content Creator",
      description: "Create 5 posts",
      category: "post",
      points: 20,
      badgeUrl: "/achievements/content-creator.svg",
      requirement: 5,
      level: 1,
      isActive: true
    },
    {
      name: "Popular Poster",
      description: "Receive 10 likes on your posts",
      category: "post",
      points: 30,
      badgeUrl: "/achievements/popular-poster.svg",
      requirement: 10,
      level: 1,
      isActive: true
    },
    
    // Milestone achievements
    {
      name: "Sports Novice",
      description: "Earn 100 achievement points",
      category: "milestone",
      points: 25,
      badgeUrl: "/achievements/sports-novice.svg",
      requirement: 100,
      level: 1,
      isActive: true
    },
    {
      name: "Sports Enthusiast",
      description: "Earn 250 achievement points",
      category: "milestone",
      points: 50,
      badgeUrl: "/achievements/sports-enthusiast.svg",
      requirement: 250,
      level: 2,
      isActive: true
    },
    {
      name: "Sports Master",
      description: "Earn 500 achievement points",
      category: "milestone",
      points: 100,
      badgeUrl: "/achievements/sports-master.svg",
      requirement: 500,
      level: 3,
      isActive: true
    }
  ];

  // Insert the achievements
  // Insert the achievements one by one with correct typing
  for (const achievement of initialAchievements) {
    await db.insert(achievements).values({
      name: achievement.name,
      description: achievement.description,
      category: achievement.category as any, // Type assertion to handle the category enum
      points: achievement.points,
      badgeUrl: achievement.badgeUrl,
      requirement: achievement.requirement,
      level: achievement.level,
      isActive: achievement.isActive
    });
  }
  
  console.log(`[migration] Successfully seeded ${initialAchievements.length} achievements`);
}