import { db } from './server/db';
import * as schema from './shared/schema';
import { sql } from 'drizzle-orm';

async function createTables() {
  try {
    console.log('Starting to create database tables...');
    
    // Create schema
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        preferred_sports TEXT[],
        skill_level JSONB,
        preferred_locations TEXT[],
        bio TEXT,
        phone_number TEXT,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS facilities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        district TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        open_time TIME,
        close_time TIME,
        contact_phone TEXT,
        image_url TEXT,
        courts INTEGER,
        amenities JSONB,
        age_restriction TEXT,
        gender_suitability TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        average_rating DOUBLE PRECISION,
        total_reviews INTEGER DEFAULT 0,
        approval_status TEXT DEFAULT 'approved',
        search_source TEXT
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        facility_id INTEGER NOT NULL REFERENCES facilities(id),
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        facility_id INTEGER NOT NULL REFERENCES facilities(id),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        sport_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        creator_id INTEGER NOT NULL REFERENCES users(id),
        image_url TEXT,
        district TEXT,
        is_private BOOLEAN DEFAULT false,
        member_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        facility_id INTEGER REFERENCES facilities(id),
        event_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        sport_type TEXT,
        skill_level TEXT,
        max_participants INTEGER,
        is_official BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        organizer_id INTEGER REFERENCES users(id),
        group_id INTEGER REFERENCES groups(id),
        approval_status TEXT DEFAULT 'approved',
        search_source TEXT,
        website TEXT,
        image_url TEXT,
        location JSONB
      );

      CREATE TABLE IF NOT EXISTS event_rsvps (
        event_id INTEGER NOT NULL REFERENCES events(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (event_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        district TEXT,
        distance DOUBLE PRECISION,
        difficulty TEXT,
        path_coordinates JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS court_availability (
        id SERIAL PRIMARY KEY,
        facility_id INTEGER NOT NULL REFERENCES facilities(id),
        court_number INTEGER NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER NOT NULL REFERENCES groups(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        joined_at TIMESTAMP DEFAULT NOW(),
        role TEXT DEFAULT 'member',
        PRIMARY KEY (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        image_url TEXT,
        facility_id INTEGER REFERENCES facilities(id),
        event_id INTEGER REFERENCES events(id),
        sport_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP,
        is_public BOOLEAN DEFAULT true,
        group_id INTEGER REFERENCES groups(id),
        likes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        likes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS connections (
        user_id INTEGER NOT NULL REFERENCES users(id),
        connected_user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP,
        PRIMARY KEY (user_id, connected_user_id)
      );

      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, post_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    console.log('All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    process.exit(0);
  }
}

createTables();