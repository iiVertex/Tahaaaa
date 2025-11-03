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
    if (!user) {
      logger.warn('User not found in getProfile', { userId });
      return null;
    }
    
    // Ensure existing users without coins get 1000 default
    if (user.coins === undefined || user.coins === null) {
      logger.info('User missing coins, initializing to 1000', { userId });
      await this.usersRepo.update(userId, { coins: 1000 });
      user.coins = 1000;
    }
    
    const userProfile = await this.usersRepo.getUserProfile(userId);
    logger.info('getProfile retrieved userProfile', { 
      userId, 
      hasUserProfile: !!userProfile, 
      profileJsonKeys: userProfile ? Object.keys(userProfile.profile_json || {}) : []
    });
    
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
    
    // Always return actual userProfile if it exists, otherwise return empty structure
    // This allows mission generation to distinguish between "no profile" and "empty profile"
    return { 
      user, 
      userProfile: userProfile || { profile_json: {} }, 
      stats, 
      suggestions 
    };
  }

  async updateProfile(userId, payload) {
    const { username, avatar_url, preferences, settings, profile_json, nickname } = payload || {};
    
    logger.info('ProfileService.updateProfile called', { userId, hasProfileJson: !!profile_json, keys: Object.keys(payload || {}) });
    
    // Update user fields (username, avatar_url)
    if (username || avatar_url) {
      await this.usersRepo.update(userId, { username, avatar_url });
    }
    
    // Get existing profile
    const existing = await this.usersRepo.getUserProfile(userId);
    logger.info('Existing profile retrieved', { userId, exists: !!existing, hasProfileJson: !!(existing?.profile_json) });
    
    // Merge profile_json if provided (new comprehensive format)
    if (profile_json) {
      // If profile_json is explicitly empty object, clear everything
      const isClearing = Object.keys(profile_json).length === 0 && existing?.profile_json;
      const mergedProfile = isClearing 
        ? {} // Completely clear if explicitly set to empty
        : {
            ...(existing?.profile_json || {}),
            ...profile_json, // New fields override old ones
            // Ensure arrays are always arrays (never undefined/null)
            insurance_preferences: Array.isArray(profile_json.insurance_preferences) ? profile_json.insurance_preferences : (profile_json.insurance_preferences !== undefined ? (existing?.profile_json?.insurance_preferences || []) : (existing?.profile_json?.insurance_preferences || [])),
            areas_of_interest: Array.isArray(profile_json.areas_of_interest) ? profile_json.areas_of_interest : (profile_json.areas_of_interest !== undefined ? (existing?.profile_json?.areas_of_interest || []) : (existing?.profile_json?.areas_of_interest || [])),
            vulnerabilities: Array.isArray(profile_json.vulnerabilities) ? profile_json.vulnerabilities : (profile_json.vulnerabilities !== undefined ? (existing?.profile_json?.vulnerabilities || []) : (existing?.profile_json?.vulnerabilities || [])),
            // Preserve preferences and settings if they exist in payload but merge with profile_json
            preferences: profile_json.preferences !== undefined ? (profile_json.preferences || existing?.profile_json?.preferences || {}) : existing?.profile_json?.preferences || {},
            settings: profile_json.settings !== undefined ? (profile_json.settings || existing?.profile_json?.settings || {}) : existing?.profile_json?.settings || {}
          };
      
      logger.info('Merging profile_json', { 
        userId, 
        existingKeys: Object.keys(existing?.profile_json || {}),
        newKeys: Object.keys(profile_json),
        mergedKeys: Object.keys(mergedProfile),
        isClearing: isClearing,
        insurancePrefsType: Array.isArray(mergedProfile.insurance_preferences) ? 'array' : typeof mergedProfile.insurance_preferences,
        insurancePrefsLength: Array.isArray(mergedProfile.insurance_preferences) ? mergedProfile.insurance_preferences.length : 'N/A'
      });
      
      if (!existing) {
        const created = await this.usersRepo.createUserProfile(userId, mergedProfile);
        logger.info('Profile created', { 
          userId, 
          created: !!created,
          profileKeys: Object.keys(mergedProfile),
          name: mergedProfile.name,
          age: mergedProfile.age
        });
        // Verify it was actually created
        const verify = await this.usersRepo.getUserProfile(userId);
        if (!verify || !verify.profile_json) {
          logger.error('Profile creation verification failed', { userId });
        }
      } else {
        const updated = await this.usersRepo.updateUserProfile(userId, mergedProfile);
        logger.info('Profile updated', { 
          userId, 
          updated: !!updated,
          profileKeys: Object.keys(mergedProfile),
          name: mergedProfile.name,
          age: mergedProfile.age
        });
        // Verify it was actually updated
        const verify = await this.usersRepo.getUserProfile(userId);
        if (!verify || verify.profile_json?.name !== mergedProfile.name) {
          logger.error('Profile update verification failed', { 
            userId,
            expectedName: mergedProfile.name,
            actualName: verify?.profile_json?.name
          });
        }
      }
    } else if (preferences || settings) {
      // Legacy: handle preferences/settings separately if profile_json not provided
      const profileData = {
        ...(existing?.profile_json || {}),
        preferences: { ...(existing?.profile_json?.preferences || {}), ...(preferences || {}) },
        settings: { ...(existing?.profile_json?.settings || {}), ...(settings || {}) }
      };
      if (!existing) {
        await this.usersRepo.createUserProfile(userId, profileData);
      } else {
        await this.usersRepo.updateUserProfile(userId, profileData);
      }
    }
    
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'profile_updated', created_at: new Date().toISOString() });
    
    // Retrieve and return the updated profile
    const updated = await this.getProfile(userId);
    logger.info('Returning updated profile', { 
      userId, 
      hasUser: !!updated?.user, 
      hasUserProfile: !!updated?.userProfile,
      profileJsonKeys: Object.keys(updated?.userProfile?.profile_json || {})
    });
    return updated;
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const profileService = undefined;


