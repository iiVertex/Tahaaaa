import { db } from './supabase.js';
import { logger } from '../utils/logger.js';

// Gamification service for XP, LifeScore, and rewards
export class GamificationService {
  constructor() {
    this.xpPerLevel = 100;
    this.maxLifeScore = 1000;
  }

  // Calculate XP required for next level
  calculateXPForLevel(level) {
    return level * this.xpPerLevel;
  }

  // Calculate current level from XP
  calculateLevelFromXP(xp) {
    return Math.floor(xp / this.xpPerLevel) + 1;
  }

  // Calculate XP progress for current level
  calculateXPProgress(xp, level) {
    const currentLevelXP = (level - 1) * this.xpPerLevel;
    const nextLevelXP = level * this.xpPerLevel;
    const progressXP = xp - currentLevelXP;
    const requiredXP = nextLevelXP - currentLevelXP;
    
    return {
      current: progressXP,
      required: requiredXP,
      percentage: Math.round((progressXP / requiredXP) * 100)
    };
  }

  // Award XP and update level
  async awardXP(userId, xpAmount, reason = 'mission_completion') {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newXP = user.xp + xpAmount;
      const newLevel = this.calculateLevelFromXP(newXP);
      const levelUp = newLevel > user.level;

      await db.updateUser(userId, {
        xp: newXP,
        level: newLevel
      });

      logger.info('XP awarded', {
        userId,
        xpAmount,
        newXP,
        newLevel,
        levelUp,
        reason
      });

      return {
        xpGained: xpAmount,
        newXP,
        newLevel,
        levelUp,
        progress: this.calculateXPProgress(newXP, newLevel)
      };
    } catch (error) {
      logger.error('Error awarding XP:', error);
      throw error;
    }
  }

  // Update LifeScore
  async updateLifeScore(userId, change, reason = 'mission_completion') {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newLifeScore = Math.min(
        Math.max(user.lifescore + change, 0),
        this.maxLifeScore
      );

      await db.updateUser(userId, {
        lifescore: newLifeScore
      });

      logger.info('LifeScore updated', {
        userId,
        change,
        newLifeScore,
        reason
      });

      return {
        change,
        newLifeScore,
        percentage: Math.round((newLifeScore / this.maxLifeScore) * 100)
      };
    } catch (error) {
      logger.error('Error updating LifeScore:', error);
      throw error;
    }
  }

  // Award coins
  async awardCoins(userId, coinAmount, reason = 'mission_completion') {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newCoins = Math.max(user.coins + coinAmount, 0);

      await db.updateUser(userId, {
        coins: newCoins
      });

      logger.info('Coins awarded', {
        userId,
        coinAmount,
        newCoins,
        reason
      });

      return {
        coinsGained: coinAmount,
        newCoins
      };
    } catch (error) {
      logger.error('Error awarding coins:', error);
      throw error;
    }
  }

  // Update streak
  async updateStreak(userId, increment = true) {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const newStreak = increment 
        ? user.current_streak + 1
        : Math.max(user.current_streak - 1, 0);
      
      const newLongestStreak = Math.max(newStreak, user.longest_streak);

      await db.updateUser(userId, {
        current_streak: newStreak,
        longest_streak: newLongestStreak
      });

      logger.info('Streak updated', {
        userId,
        newStreak,
        newLongestStreak,
        increment
      });

      return {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        streakBroken: !increment && user.current_streak > 0
      };
    } catch (error) {
      logger.error('Error updating streak:', error);
      throw error;
    }
  }

  // Process mission completion rewards
  async processMissionCompletion(userId, missionId, missionData) {
    try {
      const rewards = {
        xp: 0,
        lifescore: 0,
        coins: 0
      };

      // Base rewards from mission
      rewards.xp = missionData.xp_reward || 0;
      rewards.lifescore = missionData.lifescore_impact || 0;
      rewards.coins = Math.floor((missionData.xp_reward || 0) * 0.1); // 10% of XP as coins

      // Apply rewards
      const xpResult = await this.awardXP(userId, rewards.xp, 'mission_completion');
      const lifescoreResult = await this.updateLifeScore(userId, rewards.lifescore, 'mission_completion');
      const coinsResult = await this.awardCoins(userId, rewards.coins, 'mission_completion');

      // Update streak (mission completion counts as activity)
      const streakResult = await this.updateStreak(userId, true);

      logger.info('Mission completion processed', {
        userId,
        missionId,
        rewards,
        xpResult,
        lifescoreResult,
        coinsResult,
        streakResult
      });

      return {
        rewards,
        xpResult,
        lifescoreResult,
        coinsResult,
        streakResult,
        levelUp: xpResult.levelUp
      };
    } catch (error) {
      logger.error('Error processing mission completion:', error);
      throw error;
    }
  }

  // Get user gamification stats
  async getUserStats(userId) {
    try {
      const user = await db.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const xpProgress = this.calculateXPProgress(user.xp, user.level);
      const lifescorePercentage = Math.round((user.lifescore / this.maxLifeScore) * 100);

      return {
        xp: user.xp,
        level: user.level,
        xpProgress,
        lifescore: user.lifescore,
        lifescorePercentage,
        coins: user.coins,
        currentStreak: user.current_streak,
        longestStreak: user.longest_streak
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Calculate LifeScore status
  getLifeScoreStatus(lifescore) {
    const percentage = (lifescore / this.maxLifeScore) * 100;
    
    if (percentage >= 80) return 'excellent';
    if (percentage >= 60) return 'high';
    if (percentage >= 40) return 'medium';
    return 'low';
  }

  // Get achievement suggestions based on user progress
  async getAchievementSuggestions(userId) {
    try {
      const stats = await this.getUserStats(userId);
      const suggestions = [];

      // Level-based suggestions
      if (stats.level < 5) {
        suggestions.push({
          type: 'level',
          title: 'Rising Star',
          description: 'Reach level 5 to unlock new missions',
          progress: stats.level,
          target: 5
        });
      }

      // LifeScore suggestions
      if (stats.lifescore < 500) {
        suggestions.push({
          type: 'lifescore',
          title: 'Health Champion',
          description: 'Reach 500 LifeScore for better insurance rates',
          progress: stats.lifescore,
          target: 500
        });
      }

      // Streak suggestions
      if (stats.currentStreak < 7) {
        suggestions.push({
          type: 'streak',
          title: 'Consistency King',
          description: 'Maintain a 7-day streak for bonus rewards',
          progress: stats.currentStreak,
          target: 7
        });
      }

      return suggestions;
    } catch (error) {
      logger.error('Error getting achievement suggestions:', error);
      return [];
    }
  }
}

// Export singleton instance
export const gamificationService = new GamificationService();
