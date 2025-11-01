import { logger } from '../utils/logger.js';
import { db } from './supabase.js';

/**
 * Clerk Service - Syncs Clerk authentication users to database
 * Maps Clerk user IDs to database UUIDs for seamless integration
 */
export class ClerkService {
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Sync Clerk user to database
   * Creates or retrieves database user record based on Clerk ID
   * @param {string} clerkId - Clerk user ID from JWT token
   * @param {object} clerkData - Additional Clerk user data (email, username, etc.)
   * @returns {Promise<object>} Database user record with UUID
   */
  async syncClerkUser(clerkId, clerkData = {}) {
    try {
      logger.info('Syncing Clerk user to database', { clerkId, hasEmail: !!clerkData.email });

      // Check if user exists by clerk_id
      let user = await this.getUserByClerkId(clerkId);
      
      if (!user) {
        // Create new user record
        logger.info('Creating new database user for Clerk ID', { clerkId, email: clerkData.email });
        
        user = await this.createUserFromClerk(clerkId, clerkData);
        logger.info('Created new database user', { userId: user.id, clerkId });
      } else {
        // Update email if it changed (Clerk email might be updated)
        if (clerkData.email && clerkData.email !== user.email) {
          logger.info('Updating user email from Clerk', { userId: user.id, oldEmail: user.email, newEmail: clerkData.email });
          await this.updateUserEmail(user.id, clerkData.email);
          user.email = clerkData.email;
        }
        
        // Update last_active_at
        await this.updateUserActivity(user.id);
      }

      return user;
    } catch (error) {
      logger.error('Error syncing Clerk user', { clerkId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user by Clerk ID
   * @param {string} clerkId - Clerk user ID
   * @returns {Promise<object|null>} User record or null
   */
  async getUserByClerkId(clerkId) {
    try {
      if (this.db.getUserByClerkId) {
        // Real database method
        return await this.db.getUserByClerkId(clerkId);
      } else {
        // Mock database - check users array
        const user = this.db.users?.find(u => u.clerk_id === clerkId) || null;
        return user;
      }
    } catch (error) {
      logger.error('Error getting user by Clerk ID', { clerkId, error: error.message });
      return null;
    }
  }

  /**
   * Create new user record from Clerk data
   * @param {string} clerkId - Clerk user ID
   * @param {object} clerkData - Clerk user data
   * @returns {Promise<object>} Created user record
   */
  async createUserFromClerk(clerkId, clerkData) {
    const userData = {
      clerk_id: clerkId,
      email: clerkData.email || `user_${clerkId}@qiclife.com`,
      username: clerkData.username || clerkData.email?.split('@')[0] || `user_${clerkId.slice(0, 8)}`,
      lifescore: 0,
      xp: 0,
      level: 1,
      streak_days: 0,
      longest_streak: 0,
      coins: 1000, // Starting coins for new users
      language_preference: 'en',
      theme_preference: 'light',
      timezone: 'Asia/Qatar',
      notification_preferences: { push: true, email: true, sms: false },
      avatar_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    };

    if (this.db.createUser) {
      // Real database - use query method
      return await this.db.createUser(userData);
    } else {
      // Mock database - add to users array
      const newUser = {
        ...userData,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      if (!this.db.users) {
        this.db.users = [];
      }
      this.db.users.push(newUser);
      logger.info('Created user in mock database', { userId: newUser.id, clerkId });
      return newUser;
    }
  }

  /**
   * Update user email
   * @param {string} userId - Database user UUID
   * @param {string} email - New email
   */
  async updateUserEmail(userId, email) {
    if (this.db.updateUser) {
      await this.db.updateUser(userId, { email });
    } else if (this.db.users) {
      const user = this.db.users.find(u => u.id === userId);
      if (user) {
        user.email = email;
        user.updated_at = new Date().toISOString();
      }
    }
  }

  /**
   * Update user last_active_at timestamp
   * @param {string} userId - Database user UUID
   */
  async updateUserActivity(userId) {
    const updates = { last_active_at: new Date().toISOString() };
    
    if (this.db.updateUser) {
      await this.db.updateUser(userId, updates);
    } else if (this.db.users) {
      const user = this.db.users.find(u => u.id === userId);
      if (user) {
        user.last_active_at = updates.last_active_at;
        user.updated_at = new Date().toISOString();
      }
    }
  }
}

// Singleton instance
export const clerkService = new ClerkService();

