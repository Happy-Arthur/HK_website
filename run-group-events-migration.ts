/**
 * Script to manually run the group events tables migration
 */
import { createGroupEventsTables } from "./server/migrations/group-events-tables";

async function main() {
  try {
    await createGroupEventsTables();
    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();