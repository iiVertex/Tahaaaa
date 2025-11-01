import { logger } from '../utils/logger.js';

export class PlayService {
  // deps.repos: { playActivity, users, analytics }
  constructor(deps = {}) {
    this.playActivityRepo = deps.playActivity;
    this.usersRepo = deps.users;
    this.analyticsRepo = deps.analytics;
  }

  /**
   * Check if user has remaining spins for today (max 3 spins/day)
   * @param {string} userId
   * @returns {Promise<{ remaining: number, canSpin: boolean }>}
   */
  async getRemainingSpins(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Count spins today
      const todaySpins = await this.playActivityRepo?.getByUserAndDate?.(userId, today, 'roulette_spin') || [];
      const spinCount = Array.isArray(todaySpins) ? todaySpins.length : 0;
      const remaining = Math.max(0, 3 - spinCount);
      
      return {
        remaining,
        canSpin: remaining > 0,
        spinCount,
        maxSpins: 3
      };
    } catch (error) {
      logger.error('Error getting remaining spins:', error);
      return { remaining: 3, canSpin: true, spinCount: 0, maxSpins: 3 };
    }
  }

  /**
   * Record a roulette spin activity
   * @param {string} userId
   * @param {Object} rouletteData - Result from AI generation
   * @returns {Promise<Object>} Recorded activity
   */
  async recordRouletteSpin(userId, rouletteData) {
    try {
      // Check spin limit first
      const { canSpin, remaining, spinCount } = await this.getRemainingSpins(userId);
      if (!canSpin) {
        return { ok: false, status: 429, message: 'Daily spin limit reached (3 spins/day). Try again tomorrow!' };
      }

      // Record the spin
      const activity = {
        user_id: userId,
        activity_type: 'roulette_spin',
        activity_data: rouletteData,
        coins_earned: rouletteData.coins_earned || 100,
        xp_earned: rouletteData.xp_earned || 50,
        activity_date: new Date().toISOString().split('T')[0]
      };

      const recorded = await this.playActivityRepo?.create?.(activity) || activity;
      
      // Award coins and XP (if gamification service available)
      // Note: This would typically be handled by gamification service
      // For now, we'll return the coins/xp to be awarded by the caller
      
      logger.info('Roulette spin recorded', { userId, remaining: remaining - 1, coins: activity.coins_earned });
      
      return {
        ok: true,
        activity: recorded,
        coins_earned: activity.coins_earned,
        xp_earned: activity.xp_earned,
        remaining: remaining - 1,
        spinCount: spinCount + 1
      };
    } catch (error) {
      logger.error('Error recording roulette spin:', error);
      return { ok: false, status: 500, message: error.message || 'Failed to record spin' };
    }
  }
}

