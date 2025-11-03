import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Flag to decide whether to use real Supabase or in-memory mock
const useRealSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) && process.env.USE_SUPABASE !== 'false';

export const supabase = useRealSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// In-memory mock database for development/testing without external services
class MockDatabaseService {
  constructor() {
    this.isMock = true; // Flag to indicate this is mock database
    this.supabase = null; // Mock database doesn't use Supabase client
    const now = new Date().toISOString();
    this.users = [
      {
        id: 'mock-user-001',
        email: 'user@qiclife.com',
        username: 'qicuser',
        avatar_url: '',
        lifescore: 45,
        xp: 350,
        level: 4,
        current_streak: 3,
        longest_streak: 10,
        coins: 1000, // Updated to 1000 starting coins
        language: 'en',
        theme: 'light',
        created_at: now,
        updated_at: now
      }
    ];
    this.missions = [
      {
        id: 'mission-safe-driving-1',
        title_en: 'Safe Driving: 7-day Challenge',
        category: 'safe_driving',
        difficulty: 'medium',
        xp_reward: 75,
        lifescore_impact: 15,
        coin_reward: 20, // Added coin_reward field
        is_collaborative: false,
        created_at: now
      },
      {
        id: 'mission-health-2',
        title_en: 'Daily Health Check',
        category: 'health',
        difficulty: 'easy',
        xp_reward: 40,
        lifescore_impact: 10,
        is_collaborative: false,
        created_at: now
      }
    ];
    this.user_missions = [];
    this.user_profiles = [];
    this.onboarding_responses = [];
    this.user_sessions = [];
    this.play_activity = [];
    this.user_stats = new Map(); // session_id -> stats
    this.mission_steps = []; // AI-generated 3-step plans for started missions
    this.user_rewards = []; // Track redeemed rewards: { id, user_id, reward_id, redeemed_at, coupon_code }
  }

  async getUserById(userId) {
    return this.users.find(u => u.id === userId) || null;
  }

  async getUserByClerkId(clerkId) {
    return this.users.find(u => u.clerk_id === clerkId) || null;
  }

  async createUser(userData) {
    const user = {
      ...userData,
      id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.users.push(user);
    return user;
  }

  async updateUser(userId, updates) {
    const idx = this.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    this.users[idx] = { ...this.users[idx], ...updates, updated_at: new Date().toISOString() };
    return this.users[idx];
  }

  async getMissions(filters = {}) {
    return this.missions.filter(m => {
      return Object.entries(filters).every(([k, v]) => (v ? m[k] === v : true));
    });
  }

  async getMissionById(missionId) {
    return this.missions.find(m => m.id === missionId) || null;
  }

  async createMission(missionData) {
    const mission = {
      ...missionData,
      id: missionData.id || `mission-${Date.now()}-${Math.random()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.missions.push(mission);
    return mission;
  }

  async getUserMissions(id, status = null) {
    const list = this.user_missions.filter(um => um.user_id === id || um.session_id === id);
    return status ? list.filter(um => um.status === status) : list;
  }

  async startMission(userId, missionId) {
    const userMission = {
      id: `um-${Date.now()}-${Math.random()}`,
      user_id: userId,
      session_id: userId,
      mission_id: missionId,
      status: 'active',
      started_at: new Date().toISOString(),
      progress: 0
    };
    this.user_missions.push(userMission);
    return userMission; // Return the created user_mission so we can use its id for steps
  }

  async completeMission(id, missionId, completionData = {}) {
    const item = this.user_missions.find(um => (um.user_id === id || um.session_id === id) && um.mission_id === missionId);
    if (!item) return null;
    
    // Get the mission to extract rewards
    const mission = this.missions.find(m => m.id === missionId);
    
    // Use reward data from completionData if provided, otherwise calculate from mission
    const coinsEarned = completionData.coins_earned !== undefined 
      ? completionData.coins_earned 
      : (mission?.coin_reward || (mission?.difficulty === 'easy' ? 10 : mission?.difficulty === 'medium' ? 20 : 30));
    const xpEarned = completionData.xp_earned !== undefined 
      ? completionData.xp_earned 
      : (mission?.xp_reward || 10);
    const lifescoreChange = completionData.lifescore_change !== undefined 
      ? completionData.lifescore_change 
      : (mission?.lifescore_impact || 0);
    
    Object.assign(item, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      coins_earned: coinsEarned,
      xp_earned: xpEarned,
      lifescore_change: lifescoreChange,
      completion_data: completionData,
      updated_at: new Date().toISOString()
    });
    return item;
  }

  // Mission Steps operations
  async createMissionSteps(userMissionId, steps) {
    // steps: array of { step_number, title, description }
    const created = steps.map(s => ({
      id: `step-${Date.now()}-${Math.random()}`,
      user_mission_id: userMissionId,
      step_number: s.step_number,
      title: s.title,
      description: s.description,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    if (!this.mission_steps) this.mission_steps = [];
    this.mission_steps.push(...created);
    return created;
  }

  async getMissionSteps(userMissionId) {
    if (!this.mission_steps) return [];
    return this.mission_steps.filter(s => s.user_mission_id === userMissionId).sort((a, b) => a.step_number - b.step_number);
  }

  async completeMissionStep(stepId) {
    if (!this.mission_steps) return null;
    const step = this.mission_steps.find(s => s.id === stepId);
    if (!step) return null;
    step.status = 'completed';
    step.completed_at = new Date().toISOString();
    step.updated_at = new Date().toISOString();
    return step;
  }

  async getUserProfile(userId) {
    const profile = this.user_profiles.find(p => p.user_id === userId) || null;
    // Debug: log what we're returning
    if (profile) {
      console.log(`[MockDB] getUserProfile(${userId}): Found profile with ${Object.keys(profile.profile_json || {}).length} keys in profile_json`);
    } else {
      console.log(`[MockDB] getUserProfile(${userId}): No profile found. Total profiles: ${this.user_profiles.length}`);
    }
    return profile;
  }

  async createUserProfile(userId, profileData) {
    console.log(`[MockDB] createUserProfile(${userId}): Creating with ${Object.keys(profileData).length} keys`);
    const profile = { user_id: userId, profile_json: profileData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.user_profiles.push(profile);
    console.log(`[MockDB] createUserProfile(${userId}): Created. Total profiles: ${this.user_profiles.length}`);
    return profile;
  }

  async updateUserProfile(userId, profileData) {
    console.log(`[MockDB] updateUserProfile(${userId}): Updating with ${Object.keys(profileData).length} keys`);
    const idx = this.user_profiles.findIndex(p => p.user_id === userId);
    const payload = { profile_json: profileData, updated_at: new Date().toISOString() };
    if (idx === -1) {
      console.log(`[MockDB] updateUserProfile(${userId}): Profile not found, creating new`);
      const profile = { user_id: userId, ...payload, created_at: new Date().toISOString() };
      this.user_profiles.push(profile);
      return profile;
    }
    console.log(`[MockDB] updateUserProfile(${userId}): Updating existing profile at index ${idx}`);
    this.user_profiles[idx] = { ...this.user_profiles[idx], ...payload };
    console.log(`[MockDB] updateUserProfile(${userId}): Updated. profile_json keys: ${Object.keys(this.user_profiles[idx].profile_json || {}).length}`);
    return this.user_profiles[idx];
  }

  async saveOnboardingResponse(userId, stepNumber, responseData) {
    const row = { user_id: userId, step_number: stepNumber, response_data: responseData, created_at: new Date().toISOString() };
    this.onboarding_responses.push(row);
    return row;
  }

  async getOnboardingResponses(userId) {
    return this.onboarding_responses.filter(r => r.user_id === userId).sort((a, b) => a.step_number - b.step_number);
  }


  // Session-based stats operations
  async getStats(sessionId) {
    return this.user_stats.get(sessionId) || { xp: 0, level: 1, coins: 0, lifescore: 0, current_streak: 0, longest_streak: 0 };
  }

  async upsertStats(sessionId, updates) {
    const current = this.getStats(sessionId);
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    this.user_stats.set(sessionId, updated);
    return updated;
  }
  
  // Generic query method for repositories
  async query(table, operation, options = {}) {
    if (operation.type === 'insert') {
      const insertData = { ...options.data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (table === 'user_missions') {
        const idx = this.user_missions.push(insertData) - 1;
        return [this.user_missions[idx]];
      }
      if (table === 'mission_steps') {
        const idx = this.mission_steps.push(insertData) - 1;
        return [this.mission_steps[idx]];
      }
      if (table === 'onboarding_responses') {
        const idx = this.onboarding_responses.push(insertData) - 1;
        return [this.onboarding_responses[idx]];
      }
      if (table === 'user_rewards') {
        const rewardEntry = {
          id: `ur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...insertData,
          created_at: new Date().toISOString()
        };
        const idx = this.user_rewards.push(rewardEntry) - 1;
        return [this.user_rewards[idx]];
      }
      if (table === 'play_activity') {
        const activityEntry = {
          id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...insertData,
          created_at: new Date().toISOString()
        };
        const idx = this.play_activity.push(activityEntry) - 1;
        return [this.play_activity[idx]];
      }
      return [insertData];
    }
    if (operation.type === 'select') {
      if (table === 'user_missions') {
        let filtered = [...this.user_missions];
        if (options.filters) {
          Object.entries(options.filters).forEach(([k, v]) => {
            filtered = filtered.filter(item => item[k] === v);
          });
        }
        return filtered;
      }
      if (table === 'mission_steps') {
        let filtered = [...this.mission_steps];
        if (options.filters) {
          Object.entries(options.filters).forEach(([k, v]) => {
            filtered = filtered.filter(item => item[k] === v);
          });
        }
        if (options.orderBy) {
          filtered.sort((a, b) => {
            const valA = a[options.orderBy.column];
            const valB = b[options.orderBy.column];
            return options.orderBy.ascending ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
          });
        }
        return filtered;
      }
      if (table === 'onboarding_responses') {
        let filtered = [...this.onboarding_responses];
        if (options.filters) {
          Object.entries(options.filters).forEach(([k, v]) => {
            filtered = filtered.filter(item => item[k] === v);
          });
        }
        return filtered;
      }
      if (table === 'user_rewards') {
        let filtered = [...this.user_rewards];
        if (options.filters) {
          Object.entries(options.filters).forEach(([k, v]) => {
            filtered = filtered.filter(item => item[k] === v);
          });
        }
        if (options.orderBy) {
          filtered.sort((a, b) => {
            const valA = a[options.orderBy.column];
            const valB = b[options.orderBy.column];
            return options.orderBy.ascending ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
          });
        }
        return filtered;
      }
      if (table === 'play_activity') {
        let filtered = [...this.play_activity];
        if (options.filters) {
          Object.entries(options.filters).forEach(([k, v]) => {
            filtered = filtered.filter(item => item[k] === v);
          });
        }
        return filtered;
      }
      if (table === 'rewards') {
        // Mock rewards table - return empty as it's handled by RewardsRepo fallback
        return [];
      }
      return [];
    }
    return [];
  }
}

// Database service with error handling (real Supabase)
export class DatabaseService {
  constructor() {
    this.isMock = false; // Real Supabase database
    this.supabase = supabase;
    this.client = supabase;
  }

  // Generic query method with error handling
  async query(table, operation, options = {}) {
    try {
      let query = this.client.from(table);

      // Apply operation
      switch (operation.type) {
        case 'select':
          query = query.select(options.select || '*');
          if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          if (options.orderBy) {
            query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending });
          }
          if (options.limit) {
            query = query.limit(options.limit);
          }
          if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
          }
          break;

        case 'insert':
          query = query.insert(options.data);
          break;

        case 'update':
          query = query.update(options.data);
          if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          break;

        case 'delete':
          if (options.filters) {
            Object.entries(options.filters).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Database query error:', {
          table,
          operation: operation.type,
          error: error.message,
          code: error.code
        });
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Database service error:', error);
      throw error;
    }
  }

  // User operations
  async getUserById(userId) {
    const result = await this.query('users', { type: 'select' }, { 
      filters: { id: userId },
      select: 'id, clerk_id, email, username, avatar_url, lifescore, xp, level, current_streak, longest_streak, coins, language, theme, created_at, updated_at'
    });
    return result?.[0] || null;
  }

  async getUserByClerkId(clerkId) {
    const result = await this.query('users', { type: 'select' }, {
      filters: { clerk_id: clerkId },
      select: 'id, clerk_id, email, username, avatar_url, lifescore, xp, level, current_streak, longest_streak, coins, language, theme, created_at, updated_at, last_active_at'
    });
    return result?.[0] || null;
  }

  async createUser(userData) {
    // Ensure new users get 1000 coins if not specified
    const userDataWithCoins = {
      ...userData,
      coins: userData.coins !== undefined ? userData.coins : 1000
    };
    const result = await this.query('users', { type: 'insert' }, {
      data: userDataWithCoins
    });
    return result?.[0] || null;
  }

  async updateUser(userId, updates) {
    return this.query('users', { type: 'update' }, {
      filters: { id: userId },
      data: { ...updates, updated_at: new Date().toISOString() }
    });
  }

  // Mission operations
  async getMissions(filters = {}) {
    return this.query('missions', { type: 'select' }, {
      filters,
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  async getMissionById(missionId) {
    const result = await this.query('missions', { type: 'select' }, {
      filters: { id: missionId }
    });
    return result?.[0] || null;
  }

  async getUserMissions(userId, status = null) {
    const filters = { user_id: userId };
    if (status) filters.status = status;
    
    return this.query('user_missions', { type: 'select' }, {
      filters,
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  async startMission(userId, missionId) {
    return this.query('user_missions', { type: 'insert' }, {
      data: {
        user_id: userId,
        mission_id: missionId,
        status: 'active',
        started_at: new Date().toISOString(),
        progress: 0
      }
    });
  }

  async completeMission(userId, missionId, completionData = {}) {
    // Extract reward data from completionData if provided
    const coinsEarned = completionData.coins_earned;
    const xpEarned = completionData.xp_earned;
    const lifescoreChange = completionData.lifescore_change;
    
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      updated_at: new Date().toISOString(),
      completion_data: completionData
    };
    
    // Include reward fields if provided
    if (coinsEarned !== undefined) updateData.coins_earned = coinsEarned;
    if (xpEarned !== undefined) updateData.xp_earned = xpEarned;
    if (lifescoreChange !== undefined) updateData.lifescore_change = lifescoreChange;
    
    const result = await this.query('user_missions', { type: 'update' }, {
      filters: { user_id: userId, mission_id: missionId },
      data: updateData
    });
    // Return the updated user_mission record
    return result?.[0] || result || null;
  }

  // Profile operations
  async getUserProfile(userId) {
    const result = await this.query('user_profiles', { type: 'select' }, {
      filters: { user_id: userId }
    });
    return result?.[0] || null;
  }

  async createUserProfile(userId, profileData) {
    return this.query('user_profiles', { type: 'insert' }, {
      data: {
        user_id: userId,
        profile_json: profileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  }

  async updateUserProfile(userId, profileData) {
    return this.query('user_profiles', { type: 'update' }, {
      filters: { user_id: userId },
      data: {
        profile_json: profileData,
        updated_at: new Date().toISOString()
      }
    });
  }

  // Session operations
  async createSession(userId, sessionId, expiresAt) {
    return this.query('user_sessions', { type: 'insert' }, {
      data: {
        user_id: userId,
        session_id: sessionId,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }
    });
  }

  async getSession(sessionId) {
    const result = await this.query('user_sessions', { type: 'select' }, {
      filters: { session_id: sessionId }
    });
    return result?.[0] || null;
  }

  async deleteSession(sessionId) {
    return this.query('user_sessions', { type: 'delete' }, {
      filters: { session_id: sessionId }
    });
  }

  // Onboarding operations
  async saveOnboardingResponse(userId, stepNumber, responseData) {
    return this.query('onboarding_responses', { type: 'insert' }, {
      data: {
        user_id: userId,
        step_number: stepNumber,
        response_data: responseData,
        created_at: new Date().toISOString()
      }
    });
  }

  async getOnboardingResponses(userId) {
    return this.query('onboarding_responses', { type: 'select' }, {
      filters: { user_id: userId },
      orderBy: { column: 'step_number', ascending: true }
    });
  }

  // Play activity operations
  async recordPlayActivity(userId, activityType, activityData, coinsEarned, xpEarned) {
    const today = new Date().toISOString().split('T')[0];
    return this.query('play_activity', { type: 'insert' }, {
      data: {
        user_id: userId,
        activity_type: activityType,
        activity_data: activityData,
        coins_earned: coinsEarned,
        xp_earned: xpEarned,
        activity_date: today,
        created_at: new Date().toISOString()
      }
    });
  }

  async getDailyPlayActivityCount(userId, date, activityType) {
    const activities = await this.query('play_activity', { type: 'select' }, {
      filters: { user_id: userId, activity_date: date, activity_type: activityType }
    });
    return Array.isArray(activities) ? activities.length : 0;
  }
}

// Export singleton instance (real or mock)
export const db = useRealSupabase ? new DatabaseService() : new MockDatabaseService();