import { logger } from '../utils/logger.js';

export class MissionService {
  // deps.repos: { missions, userMissions, missionSteps, users, analytics }
  // deps.services: { ai, profile }
  constructor(deps = {}, gamification) {
    this.missionsRepo = deps.missions;
    this.userMissionsRepo = deps.userMissions;
    this.missionStepsRepo = deps.missionSteps;
    this.usersRepo = deps.users;
    this.analyticsRepo = deps.analytics;
    this.gamification = gamification;
    this.aiService = deps.ai;
    this.profileService = deps.profile;
  }

  async listMissions(filters = {}, userId) {
    const missions = await this.missionsRepo.list(filters);
    if (!userId) return { missions, userProgress: [] };
    const userMissions = await this.userMissionsRepo.byUser(userId);
    return { missions, userProgress: userMissions };
  }

  async generateMissions(userId) {
    try {
      logger.info('generateMissions called', { userId });
      
      // Get user profile
      const profile = await this.profileService?.getProfile?.(userId);
      if (!profile || !profile.user) {
        logger.warn('User not found in generateMissions', { userId });
        return { ok: false, status: 404, message: 'User not found' };
      }
      
      // Check if userProfile exists (even if empty, we check for the structure)
      if (!profile.userProfile) {
        logger.warn('UserProfile structure missing in generateMissions', { userId });
        return { ok: false, status: 404, message: 'User profile not found. Please complete your profile first.' };
      }
      
      // Get profile_json (should always exist even if empty)
      const profileJson = profile.userProfile.profile_json || {};
      logger.info('Profile JSON retrieved', { 
        userId, 
        profileJsonKeys: Object.keys(profileJson),
        profileJsonSize: JSON.stringify(profileJson).length
      });
      
      // Check if profile actually has data (not just empty object)
      // Also check if it's truly empty vs just having preferences/settings
      const profileKeys = Object.keys(profileJson);
      const hasProfileData = profileJson && typeof profileJson === 'object' && profileKeys.length > 0;
      const hasRequiredFields = profileKeys.some(key => ['name', 'age', 'gender', 'nationality', 'insurance_preferences'].includes(key));
      
      if (!hasProfileData || !hasRequiredFields) {
        logger.warn('Profile has no data or missing required fields', { userId, profileJson, profileKeys, hasProfileData, hasRequiredFields });
        // Return 400 (bad request) instead of 404 since user exists but profile is incomplete
        return { ok: false, status: 400, message: 'Profile incomplete. Please complete your profile (name, age, gender, nationality, and at least one insurance preference) before generating missions.' };
      }
      const requiredFields = ['name', 'age', 'gender', 'nationality', 'insurance_preferences'];
      for (const field of requiredFields) {
        if (field === 'insurance_preferences') {
          if (!Array.isArray(profileJson[field]) || profileJson[field].length === 0) {
            return { ok: false, status: 400, message: 'Profile incomplete: Please complete your profile (name, age, gender, nationality, and at least one insurance preference) before generating missions.' };
          }
        } else if (!profileJson[field]) {
          return { ok: false, status: 400, message: `Profile incomplete: ${field} is required. Please complete your profile first.` };
        }
      }

      // Generate missions using AI
      const generatedMissions = await this.aiService?.generateMissionsForUser?.(userId, profile.userProfile) || [];
      
      // Store generated missions in database
      const storedMissions = [];
      for (const mission of generatedMissions) {
        try {
          // Check if mission already exists
          if (this.missionsRepo && typeof this.missionsRepo.getById === 'function') {
            const existing = await this.missionsRepo.getById(mission.id);
            if (!existing && this.missionsRepo.create) {
              // Create new mission
              const created = await this.missionsRepo.create(mission);
              storedMissions.push(created || mission);
            } else {
              storedMissions.push(existing || mission);
            }
          } else {
            // If repo methods not available, just use the generated mission
            storedMissions.push(mission);
          }
        } catch (error) {
          logger.warn('Error storing generated mission:', { mission, error: error.message });
          storedMissions.push(mission); // Still return it even if storage fails
        }
      }

      logger.info('Missions generated', { userId, count: storedMissions.length });
      return { ok: true, missions: storedMissions };
    } catch (error) {
      logger.error('Error generating missions:', error);
      return { ok: false, status: 500, message: error.message || 'Failed to generate missions' };
    }
  }

  async startMission(userId, missionId) {
    let mission = await this.missionsRepo.getById(missionId);
    if (!mission) {
      // In development or when DB not yet seeded, allow starting ad-hoc mission IDs
      if (process.env.NODE_ENV !== 'production') {
        mission = { id: missionId, title_en: missionId, category: 'health', difficulty: 'easy', xp_reward: 10, lifescore_impact: 2, coin_reward: 10 };
      } else {
        return { ok: false, status: 404, message: 'Mission not found' };
      }
    }
    // Check if user already has an active mission (only 1 at a time)
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    if (active.length > 0) {
      const existingMission = active[0];
      // If trying to start the same mission again, return that it's already started
      if (existingMission.mission_id === missionId) {
        return { ok: false, status: 409, message: 'Mission already started' };
      }
      // If trying to start a different mission, return error about existing active mission
      return { ok: false, status: 409, message: `You already have an active mission. Complete it first before starting a new one.` };
    }
    
    // Start the mission and get the user_mission record
    const userMission = await this.userMissionsRepo.start(userId, missionId);
    
    // Generate 3-step plan using AI
    let steps = [];
    try {
      const profile = await this.profileService?.getProfile?.(userId);
      const userProfile = profile?.userProfile || { profile_json: {} };
      steps = await this.aiService?.generateMissionSteps?.(mission, userProfile) || [];
      
      if (steps.length > 0 && userMission?.id && this.missionStepsRepo) {
        // Store steps in database
        await this.missionStepsRepo.createSteps(userMission.id, steps);
      }
    } catch (error) {
      logger.warn('Error generating mission steps, continuing without steps:', error);
      // Continue even if step generation fails
    }
    
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_started', event_data: { mission_id: missionId }, created_at: new Date().toISOString() });
    logger.info('Mission started', { userId, missionId, stepsCount: steps.length });
    return { ok: true, steps };
  }

  async completeMission(userId, missionId, completionData = {}) {
    const mission = await this.missionsRepo.getById(missionId);
    if (!mission) {
      return { ok: false, status: 404, message: 'Mission not found' };
    }
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    const userMission = active.find(m => m.mission_id === missionId);
    if (!userMission) {
      return { ok: false, status: 400, message: 'Mission not started or already completed' };
    }
    await this.userMissionsRepo.complete(userId, missionId, completionData);
    const results = await this.gamification.processMissionCompletion(userId, missionId, mission);
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_completed', event_data: { mission_id: missionId }, created_at: new Date().toISOString() });
    return { ok: true, results };
  }

  /**
   * Reset daily missions for a user
   * Checks if last reset was today, and if not, generates new daily adaptive missions
   * @param {string} userId
   * @returns {Promise<Object>} Result with new missions or existing ones if already reset today
   */
  async resetDailyMissions(userId) {
    try {
      // Get user profile for AI generation
      const profile = await this.profileService?.getProfile?.(userId);
      if (!profile || !profile.userProfile) {
        return { ok: false, status: 404, message: 'User profile not found' };
      }

      // Check last reset date (stored in user_profiles or user_behavior_events)
      // For now, we'll use a simple check: generate if no daily missions exist for today
      // In production, this would check mission_instances table with instance_date = today
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Check if daily missions already exist for today
      // If mission_instances table exists, check there; otherwise, check user_missions for recurrence_type='daily'
      const existingDailyMissions = await this.userMissionsRepo.byUser(userId);
      const todayMissions = existingDailyMissions.filter(um => {
        if (um.mission && um.mission.recurrence_type === 'daily') {
          const startedDate = um.started_at ? new Date(um.started_at).toISOString().split('T')[0] : null;
          return startedDate === today;
        }
        return false;
      });

      // If daily missions already exist for today, return them instead of regenerating
      if (todayMissions.length >= 3) {
        logger.info('Daily missions already exist for today', { userId, today });
        // Fetch the actual mission details
        const missionIds = todayMissions.map(um => um.mission_id);
        const missions = [];
        for (const missionId of missionIds) {
          const mission = await this.missionsRepo.getById(missionId);
          if (mission) missions.push(mission);
        }
        return { ok: true, missions, alreadyReset: true };
      }

      // Generate new daily adaptive missions using AI
      const generatedMissions = await this.aiService?.generateAdaptiveMissions?.(userId, profile.userProfile) || [];
      
      if (generatedMissions.length === 0) {
        return { ok: false, status: 500, message: 'Failed to generate daily missions' };
      }

      // Store generated missions (as daily instances)
      const storedMissions = [];
      for (const mission of generatedMissions) {
        try {
          // Create mission in database if it doesn't exist
          let missionRecord = await this.missionsRepo.getById(mission.id);
          if (!missionRecord && this.missionsRepo.create) {
            missionRecord = await this.missionsRepo.create(mission);
          }
          storedMissions.push(missionRecord || mission);
        } catch (error) {
          logger.warn('Error storing daily mission:', { mission, error: error.message });
          storedMissions.push(mission); // Still return it even if storage fails
        }
      }

      logger.info('Daily missions reset', { userId, today, count: storedMissions.length });
      return { ok: true, missions: storedMissions, alreadyReset: false };
    } catch (error) {
      logger.error('Error resetting daily missions:', error);
      return { ok: false, status: 500, message: error.message || 'Failed to reset daily missions' };
    }
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const missionService = undefined;


