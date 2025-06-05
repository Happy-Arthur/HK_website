import { db } from "../db";
import { 
  achievements, 
  userAchievements, 
  users, 
  reviews, 
  checkIns, 
  posts, 
  postLikes, 
  connections, 
  events, 
  groupMembers,
  Achievement,
  UserAchievement
} from "@shared/schema";
import { eq, and, count, sql, sum, gt, ne } from "drizzle-orm";
import { EventEmitter } from "events";

export interface IUserAchievementProgress {
  userId: number;
  achievementId: number;
  currentProgress: number;
  requirement: number;
  completed: boolean;
  achievement: Achievement;
}

// Achievement event types
export enum AchievementEvent {
  CHECK_IN = "check_in",
  REVIEW = "review",
  JOIN_EVENT = "join_event",
  CREATE_EVENT = "create_event",
  MAKE_CONNECTION = "make_connection",
  JOIN_GROUP = "join_group",
  CREATE_GROUP = "create_group",
  CREATE_POST = "create_post",
  POST_LIKED = "post_liked"
}

export class AchievementsService {
  private eventEmitter: EventEmitter;
  
  constructor() {
    console.log("[achievements] Initializing achievements service");
    this.eventEmitter = new EventEmitter();
    
    // Set up listeners for achievement events
    this.setupEventListeners();
  }
  
  // Set up event listeners for different achievement types
  private setupEventListeners() {
    this.eventEmitter.on(AchievementEvent.CHECK_IN, async (userId: number, facilityId: number) => {
      await this.processCheckInAchievements(userId, facilityId);
    });
    
    this.eventEmitter.on(AchievementEvent.REVIEW, async (userId: number, facilityId: number) => {
      await this.processReviewAchievements(userId, facilityId);
    });
    
    this.eventEmitter.on(AchievementEvent.JOIN_EVENT, async (userId: number, eventId: number) => {
      await this.processEventParticipationAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.CREATE_EVENT, async (userId: number, eventId: number) => {
      await this.processEventCreationAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.MAKE_CONNECTION, async (userId: number, connectedUserId: number) => {
      await this.processConnectionAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.JOIN_GROUP, async (userId: number, groupId: number) => {
      await this.processGroupJoinAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.CREATE_GROUP, async (userId: number, groupId: number) => {
      await this.processGroupCreationAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.CREATE_POST, async (userId: number, postId: number) => {
      await this.processPostCreationAchievements(userId);
    });
    
    this.eventEmitter.on(AchievementEvent.POST_LIKED, async (userId: number, postId: number) => {
      await this.processPostLikedAchievements(userId, postId);
    });
  }
  
  // Generic method to trigger achievement events
  public triggerEvent(event: AchievementEvent, userId: number, entityId: number) {
    console.log(`[achievements] Triggering achievement event: ${event} for user ${userId} and entity ${entityId}`);
    this.eventEmitter.emit(event, userId, entityId);
  }
  
  // Calculate user's total achievement points
  public async getUserPoints(userId: number): Promise<number> {
    const result = await db
      .select({
        totalPoints: sum(achievements.points),
      })
      .from(userAchievements)
      .leftJoin(achievements, eq(achievements.id, userAchievements.achievementId))
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.completed, true)
      ));
    
    // Safely convert to number with a fallback to 0
    const totalPoints = result[0]?.totalPoints;
    return typeof totalPoints === 'number' ? totalPoints : 0;
  }
  
  // Get all achievements for a user
  public async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    const userAchievementsResult = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));
      
    return userAchievementsResult;
  }
  
  // Get a user's achievement progress with details
  public async getUserAchievementProgress(userId: number): Promise<IUserAchievementProgress[]> {
    const achievementsResult = await db
      .select({
        userId: userAchievements.userId,
        achievementId: achievements.id,
        currentProgress: userAchievements.progress,
        requirement: achievements.requirement,
        completed: userAchievements.completed,
        achievement: achievements
      })
      .from(achievements)
      .leftJoin(
        userAchievements, 
        and(
          eq(userAchievements.achievementId, achievements.id),
          eq(userAchievements.userId, userId)
        )
      )
      .where(eq(achievements.isActive, true));
      
    return achievementsResult.map(result => ({
      userId,
      achievementId: result.achievementId,
      currentProgress: result.currentProgress || 0,
      requirement: result.requirement,
      completed: result.completed || false,
      achievement: result.achievement
    }));
  }
  
  // Get recently earned achievements
  public async getRecentAchievements(userId: number, limit = 5): Promise<any[]> {
    const recentAchievements = await db
      .select({
        userId: userAchievements.userId,
        achievementId: achievements.id,
        name: achievements.name,
        description: achievements.description,
        badgeUrl: achievements.badgeUrl,
        points: achievements.points,
        earnedAt: userAchievements.earnedAt
      })
      .from(userAchievements)
      .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.completed, true)
      ))
      .orderBy(sql`${userAchievements.earnedAt} DESC`)
      .limit(limit);
      
    return recentAchievements;
  }
  
  // Award achievement to user
  private async awardAchievement(userId: number, achievementId: number) {
    // Check if the user already has this achievement (completed)
    const existingAchievement = await db
      .select()
      .from(userAchievements)
      .where(and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ));
      
    if (existingAchievement.length > 0 && existingAchievement[0].completed) {
      // Achievement already earned, nothing to do
      return;
    }
    
    // Get the achievement details
    const [achievement] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.id, achievementId));
      
    if (!achievement) {
      console.error(`[achievements] Achievement with ID ${achievementId} not found`);
      return;
    }
    
    // Check if user already has progress on this achievement
    if (existingAchievement.length > 0) {
      // Update the existing record
      const newProgress = existingAchievement[0].progress + 1;
      const completed = newProgress >= achievement.requirement;
      
      await db
        .update(userAchievements)
        .set({ 
          progress: newProgress,
          completed: completed,
          earnedAt: completed ? new Date() : existingAchievement[0].earnedAt
        })
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementId, achievementId)
        ));
      
      if (completed) {
        console.log(`[achievements] User ${userId} completed achievement: ${achievement.name}`);
        
        // Check for milestone achievements
        if (achievement.category !== "milestone") {
          await this.checkMilestoneAchievements(userId);
        }
      }
    } else {
      // Create a new record
      const progress = 1;
      const completed = progress >= achievement.requirement;
      
      await db
        .insert(userAchievements)
        .values({
          userId,
          achievementId,
          progress,
          completed,
          earnedAt: completed ? new Date() : undefined
        });
      
      if (completed) {
        console.log(`[achievements] User ${userId} completed achievement: ${achievement.name}`);
        
        // Check for milestone achievements
        if (achievement.category !== "milestone") {
          await this.checkMilestoneAchievements(userId);
        }
      }
    }
  }
  
  // Process achievements related to check-ins
  private async processCheckInAchievements(userId: number, facilityId: number) {
    try {
      // Get all "check_in" category achievements
      const checkInAchievements = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "check_in"),
          eq(achievements.isActive, true)
        ));
      
      for (const achievement of checkInAchievements) {
        // Check which achievement conditions apply
        if (achievement.name === "First Check-in") {
          // Award for the first check-in
          await this.awardAchievement(userId, achievement.id);
        } else if (achievement.name === "Regular Visitor") {
          // Count total check-ins
          const checkInsCount = await db
            .select({ count: count() })
            .from(checkIns)
            .where(eq(checkIns.userId, userId));
          
          const totalCheckIns = checkInsCount[0]?.count || 0;
          
          if (totalCheckIns >= achievement.requirement) {
            await this.awardAchievement(userId, achievement.id);
          }
        } else if (achievement.name === "Facility Explorer") {
          // Count unique facilities visited
          const uniqueFacilities = await db
            .select({
              distinctCount: count(sql`DISTINCT ${checkIns.facilityId}`)
            })
            .from(checkIns)
            .where(eq(checkIns.userId, userId));
          
          const uniqueFacilityCount = uniqueFacilities[0]?.distinctCount || 0;
          
          if (uniqueFacilityCount >= achievement.requirement) {
            await this.awardAchievement(userId, achievement.id);
          }
        }
      }
    } catch (error) {
      console.error("[achievements] Error processing check-in achievements:", error);
    }
  }
  
  // Process achievements related to reviews
  private async processReviewAchievements(userId: number, facilityId: number) {
    try {
      // Get all "review" category achievements
      const reviewAchievements = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "review"),
          eq(achievements.isActive, true)
        ));
      
      for (const achievement of reviewAchievements) {
        // Check which achievement conditions apply
        if (achievement.name === "First Review") {
          // Award for the first review
          await this.awardAchievement(userId, achievement.id);
        } else if (achievement.name === "Helpful Reviewer") {
          // Count total reviews
          const reviewsCount = await db
            .select({ count: count() })
            .from(reviews)
            .where(eq(reviews.userId, userId));
          
          const totalReviews = reviewsCount[0]?.count || 0;
          
          if (totalReviews >= achievement.requirement) {
            await this.awardAchievement(userId, achievement.id);
          }
        }
      }
    } catch (error) {
      console.error("[achievements] Error processing review achievements:", error);
    }
  }
  
  // Process achievements related to event participation
  private async processEventParticipationAchievements(userId: number) {
    try {
      // Get the "Event Participant" achievement
      const [eventParticipantAchievement] = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "event"),
          eq(achievements.name, "Event Participant"),
          eq(achievements.isActive, true)
        ));
      
      if (eventParticipantAchievement) {
        await this.awardAchievement(userId, eventParticipantAchievement.id);
      }
    } catch (error) {
      console.error("[achievements] Error processing event participation achievements:", error);
    }
  }
  
  // Process achievements related to event creation
  private async processEventCreationAchievements(userId: number) {
    try {
      // Get the "Event Organizer" achievement
      const [eventOrganizerAchievement] = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "event"),
          eq(achievements.name, "Event Organizer"),
          eq(achievements.isActive, true)
        ));
      
      if (eventOrganizerAchievement) {
        await this.awardAchievement(userId, eventOrganizerAchievement.id);
      }
    } catch (error) {
      console.error("[achievements] Error processing event creation achievements:", error);
    }
  }
  
  // Process achievements related to user connections
  private async processConnectionAchievements(userId: number) {
    try {
      // Get all "social" category achievements
      const socialAchievements = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "social"),
          eq(achievements.isActive, true)
        ));
      
      for (const achievement of socialAchievements) {
        // Check which achievement conditions apply
        if (achievement.name === "Social Butterfly") {
          // Award for the first connection
          await this.awardAchievement(userId, achievement.id);
        } else if (achievement.name === "Network Builder") {
          // Count total accepted connections
          const connectionsCount = await db
            .select({ count: count() })
            .from(connections)
            .where(and(
              eq(connections.userId, userId),
              eq(connections.status, "accepted")
            ));
          
          const totalConnections = connectionsCount[0]?.count || 0;
          
          if (totalConnections >= achievement.requirement) {
            await this.awardAchievement(userId, achievement.id);
          }
        }
      }
    } catch (error) {
      console.error("[achievements] Error processing connection achievements:", error);
    }
  }
  
  // Process achievements related to joining groups
  private async processGroupJoinAchievements(userId: number) {
    try {
      // Get the "Group Joiner" achievement
      const [groupJoinerAchievement] = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "group"),
          eq(achievements.name, "Group Joiner"),
          eq(achievements.isActive, true)
        ));
      
      if (groupJoinerAchievement) {
        await this.awardAchievement(userId, groupJoinerAchievement.id);
      }
    } catch (error) {
      console.error("[achievements] Error processing group join achievements:", error);
    }
  }
  
  // Process achievements related to creating groups
  private async processGroupCreationAchievements(userId: number) {
    try {
      // Get the "Group Creator" achievement
      const [groupCreatorAchievement] = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "group"),
          eq(achievements.name, "Group Creator"),
          eq(achievements.isActive, true)
        ));
      
      if (groupCreatorAchievement) {
        await this.awardAchievement(userId, groupCreatorAchievement.id);
      }
    } catch (error) {
      console.error("[achievements] Error processing group creation achievements:", error);
    }
  }
  
  // Process achievements related to creating posts
  private async processPostCreationAchievements(userId: number) {
    try {
      // Get all "post" category achievements related to creating posts
      const postAchievements = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "post"),
          eq(achievements.isActive, true)
        ));
      
      for (const achievement of postAchievements) {
        // Check which achievement conditions apply
        if (achievement.name === "First Post") {
          // Award for the first post
          await this.awardAchievement(userId, achievement.id);
        } else if (achievement.name === "Content Creator") {
          // Count total posts
          const postsCount = await db
            .select({ count: count() })
            .from(posts)
            .where(eq(posts.userId, userId));
          
          const totalPosts = postsCount[0]?.count || 0;
          
          if (totalPosts >= achievement.requirement) {
            await this.awardAchievement(userId, achievement.id);
          }
        }
      }
    } catch (error) {
      console.error("[achievements] Error processing post creation achievements:", error);
    }
  }
  
  // Process achievements related to receiving likes on posts
  private async processPostLikedAchievements(userId: number, postId: number) {
    try {
      // First check if this post belongs to the user
      const [postInfo] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId));
      
      if (!postInfo || postInfo.userId !== userId) {
        // This post doesn't belong to this user, so no achievement processing needed
        return;
      }
      
      // Get the "Popular Poster" achievement
      const [popularPosterAchievement] = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "post"),
          eq(achievements.name, "Popular Poster"),
          eq(achievements.isActive, true)
        ));
      
      if (popularPosterAchievement) {
        // Count total likes on all posts by this user
        const totalLikesResult = await db
          .select({
            totalLikes: sum(posts.likes)
          })
          .from(posts)
          .where(eq(posts.userId, userId));
        
        // Handle possible non-numeric result
        const totalLikes = totalLikesResult[0]?.totalLikes;
        const numericTotalLikes = typeof totalLikes === 'number' ? totalLikes : 0;
        
        if (numericTotalLikes >= popularPosterAchievement.requirement) {
          await this.awardAchievement(userId, popularPosterAchievement.id);
        }
      }
    } catch (error) {
      console.error("[achievements] Error processing post liked achievements:", error);
    }
  }
  
  // Check milestone achievements based on total points
  private async checkMilestoneAchievements(userId: number) {
    try {
      // Get user's total points from completed achievements
      const totalPoints = await this.getUserPoints(userId);
      
      // Get all milestone achievements
      const milestoneAchievements = await db
        .select()
        .from(achievements)
        .where(and(
          eq(achievements.category, "milestone"),
          eq(achievements.isActive, true)
        ))
        .orderBy(achievements.requirement);
      
      // Check each milestone achievement
      for (const achievement of milestoneAchievements) {
        if (totalPoints >= achievement.requirement) {
          await this.awardAchievement(userId, achievement.id);
        }
      }
    } catch (error) {
      console.error("[achievements] Error checking milestone achievements:", error);
    }
  }
}

// Create and export a singleton instance
export const achievementsService = new AchievementsService();