/**
 * Script to run the migration for adding approval columns
 * This allows us to manually execute the migration when needed
 */

import { runMigration } from './migrations/add-web-search-approval-columns';

async function main() {
  console.log('Starting migration script...');
  try {
    const result = await runMigration();
    
    if (result) {
      console.log('Migration completed successfully!');
      process.exit(0);
    } else {
      console.error('Migration failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

main();