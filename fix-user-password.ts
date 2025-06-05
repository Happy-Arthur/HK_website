import { db } from './server/db';
import { users } from './shared/schema';
import { hashPassword } from './server/auth';
import { eq } from 'drizzle-orm';

async function fixUserPassword() {
  try {
    console.log('Starting to fix user password...');

    // Get the test user
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      console.log('No users found');
      return;
    }
    
    // Hash the password properly
    const hashedPassword = await hashPassword('password123');
    console.log(`Generated proper password hash: ${hashedPassword}`);
    
    // Update the user's password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, 1));
    
    console.log('User password updated successfully!');
  } catch (error) {
    console.error('Error fixing user password:', error);
  } finally {
    process.exit(0);
  }
}

fixUserPassword();