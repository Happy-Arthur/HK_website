/**
 * Migration to create challenges and user_challenges tables
 */
import { db } from "../db";
import { challengeTypes, challengeDurations, facilityTypes, districts } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function createChallengesTables() {
  console.log("[migration] Starting migration to create challenges tables");
  
  try {
    // Check if tables already exist
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('challenges', 'user_challenges')
    `);
    
    const existingTables = tableCheck.rows.map((row: any) => row.table_name);
    const challengesExists = existingTables.includes('challenges');
    const userChallengesExists = existingTables.includes('user_challenges');
    
    console.log(`[migration] Existing tables check: challenges=${challengesExists}, user_challenges=${userChallengesExists}`);

    // Create challenges table if it doesn't exist
    if (!challengesExists) {
      console.log("[migration] Creating challenges table...");
      // Convert arrays to quoted strings for SQL
      const typesList = challengeTypes.map(t => `'${t}'`).join(', ');
      const durationsList = challengeDurations.map(d => `'${d}'`).join(', ');
      const facilityTypesList = facilityTypes.map(f => `'${f}'`).join(', ');
      const districtsList = districts.map(d => `'${d}'`).join(', ');
      
      await db.execute(sql`
        CREATE TABLE challenges (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL CHECK (type IN (${sql.raw(typesList)})),
          duration TEXT NOT NULL CHECK (duration IN (${sql.raw(durationsList)})),
          start_date TIMESTAMP WITH TIME ZONE NOT NULL,
          end_date TIMESTAMP WITH TIME ZONE NOT NULL,
          target_value INT NOT NULL,
          measure_unit TEXT NOT NULL,
          sport_type TEXT CHECK (sport_type IN (${sql.raw(facilityTypesList)})),
          district TEXT CHECK (district IN (${sql.raw(districtsList)})),
          is_active BOOLEAN DEFAULT TRUE,
          created_by INT REFERENCES users(id),
          image_url TEXT,
          reward_description TEXT,
          achievement_id INT REFERENCES achievements(id)
        )
      `);
      console.log("[migration] Challenges table created successfully");
    } else {
      console.log("[migration] Challenges table already exists, skipping creation");
    }

    // Create user_challenges table if it doesn't exist
    if (!userChallengesExists) {
      console.log("[migration] Creating user_challenges table...");
      await db.execute(sql`
        CREATE TABLE user_challenges (
          user_id INT REFERENCES users(id),
          challenge_id INT REFERENCES challenges(id),
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          current_value INT DEFAULT 0,
          completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMP WITH TIME ZONE,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (user_id, challenge_id)
        )
      `);
      console.log("[migration] User challenges table created successfully");
    } else {
      console.log("[migration] User challenges table already exists, skipping creation");
    }

    console.log("[migration] Challenges tables migration completed");
    return true;
  } catch (error) {
    console.error("[migration] Error creating challenges tables:", error);
    return false;
  }
}