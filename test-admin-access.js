import { pool } from './server/db';

async function makeUserAdmin() {
  try {
    // Update the first user to be an admin for testing
    const result = await pool.query(`
      UPDATE users 
      SET role = 'admin'
      WHERE id = 1
      RETURNING id, username, role;
    `);
    
    const user = result.rows[0];
    console.log('User updated:', user);
    
    // Check if there are any groups to test with
    const groupResult = await pool.query(`
      SELECT id, name, creator_id
      FROM groups
      LIMIT 1;
    `);
    
    if (groupResult.rows.length > 0) {
      const group = groupResult.rows[0];
      console.log('Test group available:', group);
      
      // Make sure there is a group member entry for the user as an admin
      const memberResult = await pool.query(`
        INSERT INTO group_members(user_id, group_id, role, status)
        VALUES (1, $1, 'admin', 'active')
        ON CONFLICT (user_id, group_id) 
        DO UPDATE SET role = 'admin', status = 'active'
        RETURNING user_id, group_id, role, status;
      `, [group.id]);
      
      console.log('Group member entry:', memberResult.rows[0]);
    } else {
      console.log('No groups available for testing');
    }
    
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await pool.end();
  }
}

makeUserAdmin();