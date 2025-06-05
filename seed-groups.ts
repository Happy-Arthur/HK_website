import { db } from './server/db';
import { groups, users, groupMembers, posts } from './shared/schema';

async function seedGroups() {
  try {
    console.log('Starting to seed groups...');

    // Check if there are already groups
    const existingGroups = await db.select().from(groups);
    if (existingGroups.length > 0) {
      console.log(`Found ${existingGroups.length} existing groups. Skipping seeding.`);
      return;
    }

    // Get the test user
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      console.log('No users found, cannot create groups');
      return;
    }
    
    const userId = existingUsers[0].id;
    console.log(`Using user with ID: ${userId} as creator`);

    // Create some sample groups
    const groupData = [
      {
        name: 'Hong Kong Basketball Enthusiasts',
        description: 'A group for basketball lovers in Hong Kong',
        sportType: 'basketball',
        creatorId: userId,
        district: 'central',
        isPrivate: false,
        imageUrl: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=2874&auto=format&fit=crop'
      },
      {
        name: 'HK Soccer League',
        description: 'Official group for HK Soccer League players and fans',
        sportType: 'soccer',
        creatorId: userId,
        district: 'kowloon_city',
        isPrivate: false,
        imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=2835&auto=format&fit=crop'
      },
      {
        name: 'Morning Runners Club',
        description: 'Early birds who love to run before work',
        sportType: 'running',
        creatorId: userId,
        district: 'eastern',
        isPrivate: false,
        imageUrl: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=2874&auto=format&fit=crop'
      },
      {
        name: 'HK Tennis Club',
        description: 'For tennis players of all levels in Hong Kong',
        sportType: 'tennis',
        creatorId: userId,
        district: 'wanchai',
        isPrivate: false,
        imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=2940&auto=format&fit=crop'
      },
      {
        name: 'Fitness Fanatics',
        description: 'Share workout tips and arrange group fitness sessions',
        sportType: 'fitness',
        creatorId: userId,
        district: 'central',
        isPrivate: false,
        imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2940&auto=format&fit=crop'
      }
    ];

    let createdGroups = [];
    for (const group of groupData) {
      const [createdGroup] = await db.insert(groups).values(group).returning();
      createdGroups.push(createdGroup);
      console.log(`Created group: ${group.name} with ID: ${createdGroup.id}`);
      
      // Add the creator as a member with admin role
      await db.insert(groupMembers).values({
        groupId: createdGroup.id,
        userId: userId,
        role: 'admin'
      });
      console.log(`Added user ${userId} as admin of group ${createdGroup.id}`);
      
      // Create a sample post for each group
      await db.insert(posts).values({
        userId: userId,
        content: `Welcome to the ${group.name}! Feel free to introduce yourself and share your experiences.`,
        groupId: createdGroup.id,
        isPublic: true,
        sportType: group.sportType
      });
      console.log(`Created welcome post for group ${createdGroup.id}`);
    }

    console.log('All groups created successfully!');
  } catch (error) {
    console.error('Error seeding groups:', error);
  } finally {
    process.exit(0);
  }
}

seedGroups();