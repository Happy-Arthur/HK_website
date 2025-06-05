import { db } from './server/db';
import { events, facilities, users } from './shared/schema';
import { sql } from 'drizzle-orm';

async function seedEvents() {
  try {
    console.log('Starting to seed events...');

    // First, create a test user if none exists
    const existingUsers = await db.select().from(users);
    let userId = 0;

    if (existingUsers.length === 0) {
      console.log('Creating test user...');
      const [user] = await db.insert(users).values({
        username: 'testuser',
        password: '$2b$10$GQ.yZEPKXAUqA3/TNvNrjuJtDQMrgkZ1.FT4mf1/kXN8Q4LcJf8PC', // Hash for 'password123'
        fullName: 'Test User',
        email: 'test@example.com',
        isAdmin: true
      }).returning();
      
      userId = user.id;
      console.log(`Created test user with ID: ${userId}`);
    } else {
      userId = existingUsers[0].id;
      console.log(`Using existing user with ID: ${userId}`);
    }

    // Get all facilities
    const allFacilities = await db.select().from(facilities);
    
    if (allFacilities.length === 0) {
      console.log('No facilities found, cannot create events');
      return;
    }

    // Check if there are already events
    const existingEvents = await db.select().from(events);
    if (existingEvents.length > 0) {
      console.log(`Found ${existingEvents.length} existing events. Skipping seeding.`);
      return;
    }

    // Create some sample events
    const eventData = [
      {
        name: 'Weekend Basketball Tournament',
        description: 'Join us for a friendly basketball tournament. All skill levels welcome!',
        facilityId: allFacilities[0].id,
        eventDate: new Date('2025-05-01'),
        startTime: '10:00:00',
        endTime: '16:00:00',
        sportType: 'basketball',
        skillLevel: 'all_levels',
        maxParticipants: 30,
        isOfficial: true,
        organizerId: userId
      },
      {
        name: 'Morning Yoga Session',
        description: 'Start your day with a refreshing yoga session',
        facilityId: allFacilities[1].id,
        eventDate: new Date('2025-05-02'),
        startTime: '08:00:00',
        endTime: '09:30:00',
        sportType: 'fitness',
        skillLevel: 'beginner',
        maxParticipants: 15,
        isOfficial: false,
        organizerId: userId
      },
      {
        name: 'Soccer Friendly Match',
        description: 'Friendly soccer match between local teams',
        facilityId: allFacilities[2].id,
        eventDate: new Date('2025-05-03'),
        startTime: '14:00:00',
        endTime: '16:00:00',
        sportType: 'soccer',
        skillLevel: 'intermediate',
        maxParticipants: 22,
        isOfficial: false,
        organizerId: userId
      },
      {
        name: 'Swimming Competition',
        description: 'Annual swimming competition with various categories',
        facilityId: allFacilities[3].id,
        eventDate: new Date('2025-05-10'),
        startTime: '09:00:00',
        endTime: '17:00:00',
        sportType: 'swimming',
        skillLevel: 'advanced',
        maxParticipants: 50,
        isOfficial: true,
        organizerId: userId
      },
      {
        name: 'Tennis Doubles Tournament',
        description: 'Find a partner and join our doubles tournament',
        facilityId: allFacilities[4].id,
        eventDate: new Date('2025-05-15'),
        startTime: '13:00:00',
        endTime: '18:00:00',
        sportType: 'tennis',
        skillLevel: 'intermediate',
        maxParticipants: 16,
        isOfficial: true,
        organizerId: userId
      }
    ];

    for (const event of eventData) {
      await db.insert(events).values(event);
      console.log(`Created event: ${event.name}`);
    }

    console.log('All events created successfully!');
  } catch (error) {
    console.error('Error seeding events:', error);
  } finally {
    process.exit(0);
  }
}

seedEvents();