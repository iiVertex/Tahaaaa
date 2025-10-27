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
    const now = new Date().toISOString();
    this.users = [
      {
        id: 'mock-user-001',
        email: 'user@qiclife.com',
        username: 'qicuser',
        avatar_url: '',
        lifescore: 450,
        xp: 350,
        level: 4,
        current_streak: 3,
        longest_streak: 10,
        coins: 300,
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
    this.user_skills = [];
    this.user_stats = new Map(); // session_id -> stats
  }

  async getUserById(userId) {
    return this.users.find(u => u.id === userId) || null;
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

  async getUserMissions(sessionId, status = null) {
    const list = this.user_missions.filter(um => um.session_id === sessionId);
    return status ? list.filter(um => um.status === status) : list;
  }

  async startMission(sessionId, missionId) {
    this.user_missions.push({
      session_id: sessionId,
      mission_id: missionId,
      status: 'active',
      started_at: new Date().toISOString(),
      progress: 0
    });
    return true;
  }

  async completeMission(sessionId, missionId, completionData = {}) {
    const item = this.user_missions.find(um => um.session_id === sessionId && um.mission_id === missionId);
    if (!item) return null;
    Object.assign(item, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: 100,
      completion_data: completionData
    });
    return item;
  }

  async getUserProfile(userId) {
    return this.user_profiles.find(p => p.user_id === userId) || null;
  }

  async createUserProfile(userId, profileData) {
    const profile = { user_id: userId, profile_json: profileData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.user_profiles.push(profile);
    return profile;
  }

  async updateUserProfile(userId, profileData) {
    const idx = this.user_profiles.findIndex(p => p.user_id === userId);
    const payload = { profile_json: profileData, updated_at: new Date().toISOString() };
    if (idx === -1) {
      const profile = { user_id: userId, ...payload, created_at: new Date().toISOString() };
      this.user_profiles.push(profile);
      return profile;
    }
    this.user_profiles[idx] = { ...this.user_profiles[idx], ...payload };
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

  async getUserSkills(userId) {
    return this.user_skills.filter(s => s.user_id === userId);
  }

  async unlockUserSkill(sessionId, skillId, payload = {}) {
    const exists = this.user_skills.find(s => s.session_id === sessionId && s.id === skillId);
    if (!exists) this.user_skills.push({ session_id: sessionId, id: skillId, isCompleted: true, ...payload });
    return true;
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
}

// Database service with error handling (real Supabase)
export class DatabaseService {
  constructor() {
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
      select: 'id, email, username, avatar_url, lifescore, xp, level, current_streak, longest_streak, coins, language, theme, created_at, updated_at'
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
    return this.query('user_missions', { type: 'update' }, {
      filters: { user_id: userId, mission_id: missionId },
      data: {
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: 100,
        completion_data: completionData
      }
    });
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
}

// Export singleton instance (real or mock)
export const db = useRealSupabase ? new DatabaseService() : new MockDatabaseService();
