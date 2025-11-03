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
    const userMissionsArray = Array.isArray(userMissions) ? userMissions : [];
    return { missions, userProgress: userMissionsArray };
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
      
      // Check existing missions for this user to determine if initial stage is needed
      const existingMissions = await this.listMissions({}, userId);
      const userMissions = existingMissions.userProgress || [];
      const completedMissions = userMissions.filter(um => um.status === 'completed');
      
      // Check if initial stage is complete (user has completed at least 3 missions with one of each difficulty)
      // All missions are accessible - no initial stage checking or marking
      const storedMissions = [];
      for (let idx = 0; idx < generatedMissions.length; idx++) {
        const mission = generatedMissions[idx];
        try {
          // All missions are accessible - no initial stage marking needed
          // Removed is_initial_stage property entirely
          
          // Check if mission already exists
          if (this.missionsRepo && typeof this.missionsRepo.getById === 'function') {
            const existing = await this.missionsRepo.getById(mission.id);
            if (!existing && this.missionsRepo.create) {
              // Create new mission
              const created = await this.missionsRepo.create(mission);
              storedMissions.push(created || mission);
            } else {
              // Update existing mission with initial stage flag if needed
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
    let actualMissionId = missionId;
    
    // If mission not found and missionId is a temporary daily mission ID, try to find the real mission
    if (!mission && (missionId.startsWith('daily-easy-') || missionId.startsWith('daily-medium-') || missionId.startsWith('daily-hard-'))) {
      // Extract difficulty from temporary ID
      const difficulty = missionId.includes('easy') ? 'easy' : missionId.includes('hard') ? 'hard' : 'medium';
      
      // Get all missions and find the one with matching difficulty
      const { missions } = await this.listMissions({}, userId);
      const today = new Date().toISOString().split('T')[0];
      
      // Find the most recent mission with matching difficulty created today
      const matchingMission = missions.find(m => {
        return m.difficulty === difficulty && 
               m.recurrence_type === 'daily' &&
               m.created_at && 
               m.created_at.startsWith(today);
      });
      
      if (matchingMission) {
        actualMissionId = matchingMission.id;
        mission = matchingMission;
        logger.info('Found real mission ID for temporary daily mission', { 
          temporaryId: missionId, 
          realId: actualMissionId,
          difficulty 
        });
      }
    }
    
    if (!mission) {
      // In development or when DB not yet seeded, allow starting ad-hoc mission IDs
      if (process.env.NODE_ENV !== 'production') {
        mission = { id: actualMissionId, title_en: missionId, category: 'health', difficulty: 'easy', xp_reward: 10, lifescore_impact: 2, coin_reward: 10 };
      } else {
        return { ok: false, status: 404, message: 'Mission not found' };
      }
    }
    
    // All missions are now accessible - removed initial stage gating
    
    // Check if user already has an active mission (only 1 at a time)
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    const activeArray = Array.isArray(active) ? active : [];
    if (activeArray.length > 0) {
      const existingMission = activeArray[0];
      // If trying to start the same mission again, return that it's already started
      if (existingMission.mission_id === missionId) {
        return { ok: false, status: 409, message: 'Mission already started' };
      }
      // If trying to start a different mission, return error about existing active mission
      return { ok: false, status: 409, message: `You already have an active mission. Complete it first before starting a new one.` };
    }
    
    // Start the mission and get the user_mission record (use actual mission ID)
    const userMission = await this.userMissionsRepo.start(userId, actualMissionId);
    
    // Generate 3-step plan using AI
    // CRITICAL: Deduct coins BEFORE AI API call (5 coins for mission steps generation)
    let steps = [];
    try {
      const coinCost = 5;
      const user = await this.usersRepo?.getById?.(userId);
      if (user) {
        const currentCoins = user.coins || 0;
        if (currentCoins >= coinCost) {
          await this.usersRepo.update(userId, {
            coins: Math.max(0, currentCoins - coinCost)
          });
          logger.info('Coins deducted for mission steps generation', {
            userId,
            coinCost,
            previousCoins: currentCoins,
            newCoins: currentCoins - coinCost
          });
        } else {
          logger.warn('Insufficient coins for mission steps generation, proceeding without steps', {
            userId,
            required: coinCost,
            current: currentCoins
          });
          return { ok: true, steps: [] }; // Continue without steps if insufficient coins
        }
      }
      
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
    
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_started', event_data: { mission_id: actualMissionId }, created_at: new Date().toISOString() });
    logger.info('Mission started', { userId, originalMissionId: missionId, actualMissionId, stepsCount: steps.length });
    return { ok: true, steps, missionId: actualMissionId }; // Return actual mission ID so frontend can use it
  }

  // checkInitialStageComplete method removed - all missions are accessible without gating

  async completeMission(userId, missionId, completionData = {}) {
    // First try to get mission by exact ID (UUID)
    let mission = await this.missionsRepo.getById(missionId);
    let actualMissionId = missionId;
    
    // If mission not found and missionId is a temporary daily mission ID, try to find the real mission
    if (!mission && (missionId.startsWith('daily-easy-') || missionId.startsWith('daily-medium-') || missionId.startsWith('daily-hard-'))) {
      // Extract difficulty from temporary ID
      const difficulty = missionId.includes('easy') ? 'easy' : missionId.includes('hard') ? 'hard' : 'medium';
      
      // Get all missions and find the one with matching difficulty that's active for this user
      const { userProgress, missions } = await this.listMissions({}, userId);
      const today = new Date().toISOString().split('T')[0];
      
      // Find the most recent active mission with matching difficulty that was started today
      const matchingUserMission = userProgress.find(um => {
        const m = missions.find(mission => mission.id === um.mission_id);
        return m && 
               m.difficulty === difficulty && 
               (um.status === 'active' || um.status === 'started') &&
               um.started_at && 
               um.started_at.startsWith(today);
      });
      
      if (matchingUserMission) {
        actualMissionId = matchingUserMission.mission_id;
        mission = await this.missionsRepo.getById(actualMissionId);
      }
    }
    
    if (!mission) {
      return { ok: false, status: 404, message: 'Mission not found' };
    }
    
    // Now use the actual mission ID (UUID) to find and complete the user mission
    // Check both 'active' and 'started' statuses (some missions might have 'started' status)
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    const started = await this.userMissionsRepo.byUser(userId, 'started');
    // Ensure both are arrays before spreading
    const activeArray = Array.isArray(active) ? active : [];
    const startedArray = Array.isArray(started) ? started : [];
    const allActiveOrStarted = [...activeArray, ...startedArray];
    
    // Find the user mission by actual mission ID
    let userMission = allActiveOrStarted.find(m => m.mission_id === actualMissionId);
    
    // If not found, also try matching by original missionId (for temporary IDs)
    if (!userMission && missionId !== actualMissionId) {
      userMission = allActiveOrStarted.find(m => m.mission_id === missionId);
    }
    
    // If still not found, get all user missions and search more broadly
    if (!userMission) {
      const allUserMissions = await this.userMissionsRepo.byUser(userId);
      const allUserMissionsArray = Array.isArray(allUserMissions) ? allUserMissions : [];
      userMission = allUserMissionsArray.find(m => 
        m.mission_id === actualMissionId || 
        m.mission_id === missionId ||
        (m.status !== 'completed' && m.status !== 'failed')
      );
    }
    
    if (!userMission) {
      logger.error('Mission completion failed - user mission not found', {
        userId,
        missionId,
        actualMissionId,
        activeCount: active.length,
        startedCount: started.length,
        allActiveOrStartedCount: allActiveOrStarted.length
      });
      return { ok: false, status: 400, message: 'Mission not started or already completed' };
    }
    
    logger.info('Completing mission', {
      userId,
      missionId,
      actualMissionId,
      userMissionId: userMission.id,
      userMissionStatus: userMission.status
    });
    
    // Complete the mission first
    await this.userMissionsRepo.complete(userId, actualMissionId, completionData);
    
    // Process rewards (gives coins, XP, lifescore to user)
    const results = await this.gamification.processMissionCompletion(userId, actualMissionId, mission);
    
    // Update user_mission record with earned rewards for Achievements display
    // Calculate rewards based on difficulty if mission doesn't specify them
    const coinsEarned = results?.coinsResult?.coinsGained || mission.coin_reward || (mission.difficulty === 'easy' ? 10 : mission.difficulty === 'medium' ? 20 : 30);
    const xpEarned = results?.xpResult?.xpGained || mission.xp_reward || 10;
    const lifescoreEarned = results?.lifescoreResult?.changeAmount || mission.lifescore_impact || 0;
    
    // Update the completed mission record with rewards - must pass completionData with rewards
    const completionDataWithRewards = {
      ...completionData,
      coins_earned: coinsEarned,
      xp_earned: xpEarned,
      lifescore_change: lifescoreEarned
    };
    
    // Re-complete with reward data to ensure persistence
    await this.userMissionsRepo.complete(userId, actualMissionId, completionDataWithRewards);
    
    // Verify the update persisted
    const updatedUserMission = await this.userMissionsRepo.byUser(userId);
    const completedUserMission = updatedUserMission.find(um => um.mission_id === actualMissionId && um.status === 'completed');
    if (completedUserMission) {
      // Ensure rewards are set (in case the repo's complete method doesn't handle them)
      completedUserMission.coins_earned = coinsEarned;
      completedUserMission.xp_earned = xpEarned;
      completedUserMission.lifescore_change = lifescoreEarned;
    }
    
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_completed', event_data: { mission_id: actualMissionId }, created_at: new Date().toISOString() });
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
      const existingDailyMissionsArray = Array.isArray(existingDailyMissions) ? existingDailyMissions : [];
      const todayMissions = existingDailyMissionsArray.filter(um => {
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
          // If mission has temporary ID (daily-easy-{timestamp}), create it and get real UUID
          let missionRecord = null;
          const isTemporaryId = mission.id && (mission.id.startsWith('daily-easy-') || mission.id.startsWith('daily-medium-') || mission.id.startsWith('daily-hard-'));
          
          if (isTemporaryId && this.missionsRepo.create) {
            // Create new mission (will get real UUID from database)
            // Remove temporary ID so database can assign UUID
            const missionToCreate = { ...mission };
            delete missionToCreate.id; // Let database generate UUID
            missionRecord = await this.missionsRepo.create(missionToCreate);
            logger.info('Created daily mission with real UUID', { 
              temporaryId: mission.id, 
              realId: missionRecord?.id,
              difficulty: mission.difficulty 
            });
          } else {
            // Try to get existing mission
            missionRecord = await this.missionsRepo.getById(mission.id);
            if (!missionRecord && this.missionsRepo.create) {
              missionRecord = await this.missionsRepo.create(mission);
            }
          }
          
          // Always use the mission record with real UUID if available
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

