import { logger } from '../utils/logger.js';

export class AchievementService {
  constructor(database, gamificationService) {
    this.db = database;
    this.gamification = gamificationService;
  }

  async checkAndUnlockAchievements(userId, triggerType, currentStats) {
    if (typeof this.db?.query !== 'function') return [];
    try {
      const allAchievements = await this.db.query('achievements', { type: 'select' }, { filters: { is_active: true } });
      const userAchievements = await this.db.query('user_achievements', { type: 'select' }, { filters: { user_id: userId } });
      const earnedIds = new Set((userAchievements || []).map(ua => ua.achievement_id));
      const newlyUnlocked = [];

      for (const achievement of (allAchievements || [])) {
        if (earnedIds.has(achievement.id)) continue;
        const unlocked = this.checkCondition(achievement, currentStats);
        if (!unlocked) continue;
        try {
          await this.db.query('user_achievements', { type: 'insert' }, {
            data: { user_id: userId, achievement_id: achievement.id, notification_sent: false }
          });
          if (achievement.xp_reward > 0) await this.gamification.awardXP(userId, achievement.xp_reward, 'achievement');
          if (achievement.coin_reward > 0) await this.gamification.awardCoins(userId, achievement.coin_reward, 'achievement');
          if (achievement.lifescore_boost > 0) await this.gamification.updateLifeScore(userId, achievement.lifescore_boost, 'achievement');
          newlyUnlocked.push(achievement);
          logger.info('Achievement unlocked', { userId, achievementId: achievement.id });
        } catch (error) {
          logger.warn('Failed to award achievement', { userId, achievementId: achievement.id, error: error?.message });
        }
      }
      return newlyUnlocked;
    } catch (error) {
      logger.error('Achievement check error', error);
      return [];
    }
  }

  checkCondition(achievement, stats) {
    const { condition_type, condition_value } = achievement;
    switch (condition_type) {
      case 'missions_completed':
        return (stats.total_missions_completed || 0) >= condition_value;
      case 'streak_count':
        return (stats.current_streak || stats.currentStreak || 0) >= condition_value;
      case 'lifescore_milestone':
        return (stats.lifescore || 0) >= condition_value;
      case 'xp_milestone':
        return (stats.xp || 0) >= condition_value;
      case 'coins_earned':
        return (stats.coins || 0) >= condition_value;
      case 'days_active':
        return (stats.days_active || 0) >= condition_value;
      case 'scenarios_completed':
        return (stats.scenarios_completed || 0) >= condition_value;
      case 'rewards_redeemed':
        return (stats.rewards_redeemed || 0) >= condition_value;
      default:
        return false;
    }
  }

  async getUserStats(userId) {
    if (typeof this.db?.query !== 'function') return {};
    try {
      const userRows = await this.db.query('users', { type: 'select' }, { filters: { id: userId } });
      const user = Array.isArray(userRows) ? userRows[0] : null;
      const missions = await this.db.query('user_missions', { type: 'select' }, { filters: { user_id: userId, status: 'completed' } });
      const scenarios = await this.db.query('user_scenarios', { type: 'select' }, { filters: { user_id: userId } });
      const rewards = await this.db.query('user_rewards', { type: 'select' }, { filters: { user_id: userId, status: 'redeemed' } });
      return {
        lifescore: user?.lifescore || 0,
        xp: user?.xp || 0,
        coins: user?.coins || 0,
        current_streak: user?.streak_days || user?.current_streak || 0,
        total_missions_completed: (missions || []).length || 0,
        scenarios_completed: (scenarios || []).length || 0,
        rewards_redeemed: (rewards || []).length || 0,
        days_active: this.calculateDaysActive(user)
      };
    } catch (_) {
      return {};
    }
  }

  calculateDaysActive(user) {
    if (!user?.created_at) return 0;
    const created = new Date(user.created_at);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }
}

export default AchievementService;


