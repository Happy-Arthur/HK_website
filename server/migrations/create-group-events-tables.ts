/**
 * Migration entry point for creating group events tables
 */
import { createGroupEventsTables } from "./group-events-tables";

export async function runMigration() {
  try {
    return await createGroupEventsTables();
  } catch (error) {
    console.log("[migration] Handled error in group events tables migration:", error.message);
    console.log("[migration] Continuing server startup - tables may already exist");
    return false;
  }
}