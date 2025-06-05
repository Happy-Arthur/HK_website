import pg from 'pg';
const { Pool } = pg;

// Simple script to check for admin users in the database
async function checkAdminUsers() {
  console.log('Checking for admin users in the database...');
  
  // Create the database client
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Query all users and check their admin status
    const result = await pool.query(`
      SELECT id, username, email, is_admin as "isAdmin" 
      FROM users 
      ORDER BY id ASC
    `);

    console.log(`Total users found: ${result.rows.length}`);
    
    // Check and log admin users
    const adminUsers = result.rows.filter(user => user.isAdmin === true);
    console.log(`Admin users found: ${adminUsers.length}`);
    
    if (adminUsers.length > 0) {
      console.log('Admin users:');
      adminUsers.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, isAdmin: ${user.isAdmin}`);
      });
    } else {
      console.log('No admin users found. Creating admin user for "Arthur"...');
      
      // Try to find Arthur user
      const arthurResult = await pool.query(`
        SELECT id, username, email 
        FROM users 
        WHERE username = 'Arthur'
      `);
      
      if (arthurResult.rows.length > 0) {
        const arthur = arthurResult.rows[0];
        console.log(`Found Arthur user with ID: ${arthur.id}`);
        
        // Make Arthur an admin
        await pool.query(`
          UPDATE users 
          SET is_admin = true 
          WHERE id = $1
        `, [arthur.id]);
        
        console.log(`Successfully set Arthur (ID: ${arthur.id}) as admin`);
      } else {
        console.log('Arthur user not found.');
      }
    }
    
    // Display all users for verification
    console.log('\nAll users:');
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email || 'N/A'}, isAdmin: ${user.isAdmin}`);
    });
    
  } catch (error) {
    console.error('Error checking admin users:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

checkAdminUsers().catch(console.error);