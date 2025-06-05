import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTestChallenge() {
  try {
    // Connect to DB
    const client = await pool.connect();
    console.log('Connected to database');

    // Insert a test challenge
    const challengeResult = await client.query(`
      INSERT INTO challenges (
        name, 
        description, 
        type, 
        duration, 
        start_date, 
        end_date, 
        sport_type, 
        target_value, 
        measure_unit,
        points,
        is_active, 
        created_by, 
        is_public,
        district
      ) VALUES (
        'Weekly Running Challenge', 
        'Run 20km within one week', 
        'activity', 
        'weekly', 
        NOW(), 
        NOW() + INTERVAL '7 days', 
        'running', 
        20, 
        'km',
        100,
        true, 
        3, 
        true,
        'central'
      ) RETURNING *;
    `);

    console.log('Challenge created:', challengeResult.rows[0]);

    // Create another challenge for a specific group
    const groupChallengeResult = await client.query(`
      INSERT INTO challenges (
        name, 
        description, 
        type, 
        duration, 
        start_date, 
        end_date, 
        sport_type, 
        target_value, 
        measure_unit,
        points,
        is_active, 
        created_by, 
        is_public,
        group_id,
        district
      ) VALUES (
        'Basketball Shooting Challenge', 
        'Make 100 successful shots in one week', 
        'activity', 
        'weekly', 
        NOW(), 
        NOW() + INTERVAL '7 days', 
        'basketball', 
        100, 
        'shots',
        75,
        true, 
        3, 
        false,
        1,
        'kowloon_city'
      ) RETURNING *;
    `);

    console.log('Group Challenge created:', groupChallengeResult.rows[0]);

    // Clean up
    client.release();
    console.log('All done! Database connection closed.');
  } catch (error) {
    console.error('Error creating challenges:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

createTestChallenge();