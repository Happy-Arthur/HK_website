/**
 * Migration script to create community tables: groups, group_members, posts, comments, connections
 */
import { db } from "../db";
import { log } from "../vite";

async function runMigration() {
  try {
    log("Starting migration to create community tables", "migration");

    // Check if the groups table already exists
    const checkGroupsTable = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'groups'
      );
    `);
    
    const groupsTableExists = checkGroupsTable.rows[0].exists;
    
    if (!groupsTableExists) {
      log("Creating groups table...", "migration");
      await db.execute(`
        CREATE TABLE groups (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          sport_type TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          creator_id INTEGER NOT NULL REFERENCES users(id),
          image_url TEXT,
          district TEXT,
          is_private BOOLEAN DEFAULT FALSE,
          member_count INTEGER DEFAULT 0
        );
      `);
      log("Groups table created successfully", "migration");
    } else {
      log("Groups table already exists, skipping creation", "migration");
    }

    // Check if the group_members table already exists
    const checkGroupMembersTable = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'group_members'
      );
    `);
    
    const groupMembersTableExists = checkGroupMembersTable.rows[0].exists;
    
    if (!groupMembersTableExists) {
      log("Creating group_members table...", "migration");
      await db.execute(`
        CREATE TABLE group_members (
          group_id INTEGER NOT NULL REFERENCES groups(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          joined_at TIMESTAMP DEFAULT NOW(),
          role TEXT DEFAULT 'member',
          PRIMARY KEY (group_id, user_id)
        );
      `);
      log("Group members table created successfully", "migration");
    } else {
      log("Group members table already exists, skipping creation", "migration");
    }

    // Check if the posts table already exists
    const checkPostsTable = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'posts'
      );
    `);
    
    const postsTableExists = checkPostsTable.rows[0].exists;
    
    if (!postsTableExists) {
      log("Creating posts table...", "migration");
      await db.execute(`
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          image_url TEXT,
          facility_id INTEGER REFERENCES facilities(id),
          event_id INTEGER REFERENCES events(id),
          sport_type TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP,
          is_public BOOLEAN DEFAULT TRUE,
          group_id INTEGER REFERENCES groups(id),
          likes INTEGER DEFAULT 0
        );
      `);
      log("Posts table created successfully", "migration");
    } else {
      log("Posts table already exists, skipping creation", "migration");
    }

    // Check if the comments table already exists
    const checkCommentsTable = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'comments'
      );
    `);
    
    const commentsTableExists = checkCommentsTable.rows[0].exists;
    
    if (!commentsTableExists) {
      log("Creating comments table...", "migration");
      await db.execute(`
        CREATE TABLE comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES posts(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          likes INTEGER DEFAULT 0
        );
      `);
      log("Comments table created successfully", "migration");
    } else {
      log("Comments table already exists, skipping creation", "migration");
    }

    // Check if the connections table already exists
    const checkConnectionsTable = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'connections'
      );
    `);
    
    const connectionsTableExists = checkConnectionsTable.rows[0].exists;
    
    if (!connectionsTableExists) {
      log("Creating connections table...", "migration");
      await db.execute(`
        CREATE TABLE connections (
          user_id INTEGER NOT NULL REFERENCES users(id),
          connected_user_id INTEGER NOT NULL REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP,
          PRIMARY KEY (user_id, connected_user_id)
        );
      `);
      log("Connections table created successfully", "migration");
    } else {
      log("Connections table already exists, skipping creation", "migration");
    }

    log("Community tables migration completed", "migration");
  } catch (error) {
    log(`Error creating community tables: ${error}`, "migration");
    throw error;
  }
}

export { runMigration };