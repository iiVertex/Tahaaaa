import { logger } from '../utils/logger.js';

export class ProfileService {
  // deps.repos: { users, analytics }
  constructor(repos = {}, gamification) {
    this.usersRepo = repos.users;
    this.analyticsRepo = repos.analytics;
    this.gamification = gamification;
  }

  async getProfile(userId) {
    const user = await this.usersRepo.getById(userId);
    if (!user) return null;
    const userProfile = await this.usersRepo.getUserProfile(userId);
    const stats = await this.gamification.getUserStats(userId);
    let behavior = null;
    if (this.analyticsRepo?.getBehaviorSummary) {
      try {
        behavior = await this.analyticsRepo.getBehaviorSummary(userId);
      } catch (_) {}
    }
    if (behavior) {
      stats.lifescoreTrend = behavior.lifescore_trend || 'flat';
    }
    const suggestions = await this.gamification.getAchievementSuggestions(userId);
    return { user, userProfile, stats, suggestions };
  }

  async updateProfile(userId, payload) {
    const { username, avatar_url, preferences, settings } = payload || {};
    if (username || avatar_url) {
      await this.usersRepo.update(userId, { username, avatar_url });
    }
    if (preferences || settings) {
      const existing = await this.usersRepo.getUserProfile(userId);
      const profileData = {
        ...(existing?.profile_json || {}),
        preferences: { ...(existing?.profile_json?.preferences || {}), ...(preferences || {}) },
        settings: { ...(existing?.profile_json?.settings || {}), ...(settings || {}) }
      };
      if (!existing) await this.usersRepo.createUserProfile(userId, profileData);
      else await this.usersRepo.updateUserProfile(userId, profileData);
    }
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'profile_updated', created_at: new Date().toISOString() });
    return this.getProfile(userId);
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const profileService = undefined;


