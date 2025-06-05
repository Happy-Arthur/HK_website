/**
 * Migration script to create the group_events and group_event_rsvps tables
 */
import { db } from "../db";
import { sql } from "drizzle-orm";

export async function createGroupEventsTables() {
  console.log("[migration] Starting migration to create group events tables");

  try {
    // Check if group_events table exists
    const groupEventsExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_events'
      ) as "exists";
    `);
    
    const groupEventsExists = groupEventsExistsResult[0]?.exists === true;

    // Check if group_event_rsvps table exists
    const groupEventRsvpsExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'group_event_rsvps'
      ) as "exists";
    `);
    
    const groupEventRsvpsExists = groupEventRsvpsExistsResult[0]?.exists === true;
    
    console.log(`[migration] Existing tables check: group_events=${groupEventsExists}, group_event_rsvps=${groupEventRsvpsExists}`);

    // Create group_events table if it doesn't exist
    if (!groupEventsExists) {
      console.log("[migration] Creating group_events table...");
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "group_events" (
            "id" SERIAL PRIMARY KEY,
            "group_id" INTEGER NOT NULL REFERENCES "groups" ("id") ON DELETE CASCADE,
            "organizer_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "location_name" TEXT NOT NULL,
            "address" TEXT,
            "event_date" DATE NOT NULL,
            "start_time" TEXT NOT NULL,
            "end_time" TEXT NOT NULL,
            "sport_type" TEXT NOT NULL,
            "skill_level" TEXT NOT NULL,
            "max_participants" INTEGER,
            "notes" TEXT,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log("[migration] group_events table created successfully");
      } catch (err) {
        // If table already exists despite our check, just log and continue
        if (err.code === '42P07') { // PostgreSQL error code for "relation already exists"
          console.log("[migration] group_events table already exists (detected during creation)");
        } else {
          throw err;
        }
      }
    } else {
      console.log("[migration] group_events table already exists, skipping creation");
    }

    // Create group_event_rsvps table if it doesn't exist
    if (!groupEventRsvpsExists) {
      console.log("[migration] Creating group_event_rsvps table...");
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "group_event_rsvps" (
            "id" SERIAL PRIMARY KEY,
            "event_id" INTEGER NOT NULL REFERENCES "group_events" ("id") ON DELETE CASCADE,
            "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "status" TEXT NOT NULL,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE ("event_id", "user_id")
          )
        `);
        console.log("[migration] group_event_rsvps table created successfully");
      } catch (err) {
        // If table already exists despite our check, just log and continue
        if (err.code === '42P07') { // PostgreSQL error code for "relation already exists"
          console.log("[migration] group_event_rsvps table already exists (detected during creation)");
        } else {
          throw err;
        }
      }
    } else {
      console.log("[migration] group_event_rsvps table already exists, skipping creation");
    }

    console.log("[migration] Group events tables migration completed");
    return true;
  } catch (error) {
    console.error("[migration] Error creating group events tables:", error);
    // Log error but don't throw it - this allows server to continue starting
    console.log("[migration] Continuing despite error - tables may already exist");
    return false;
  }
}