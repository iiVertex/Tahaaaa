import { db } from '../services/supabase.js';

export class UsersRepo {
  constructor(database = db) {
    this.db = database;
  }

  async getById(userId) { 
    const result = await this.db.getUserById(userId);
    return result;
  }

  async getByClerkId(clerkId) {
    if (this.db && typeof this.db.getUserByClerkId === 'function') {
      return await this.db.getUserByClerkId(clerkId);
    }
    // Fallback: check mock database
    if (this.db && this.db.users) {
      return this.db.users.find(u => u.clerk_id === clerkId) || null;
    }
    return null;
  }

  update(userId, updates) { return this.db.updateUser(userId, updates); }

  async adjustCoins(userId, delta) {
    const user = await this.getById(userId);
    const newCoins = Math.max(0, (user?.coins || 0) + delta);
    await this.update(userId, { coins: newCoins });
    return newCoins;
  }

  async adjustLifeScore(userId, delta, reason = 'manual_update') {
    const user = await this.getById(userId);
    const oldScore = user?.lifescore || 0;
    const newScore = Math.max(0, Math.min(100, oldScore + delta));
    await this.update(userId, { lifescore: newScore });
    if (typeof this.db.query === 'function') {
      try {
        await this.db.query('lifescore_history', { type: 'insert' }, {
          data: { user_id: userId, old_score: oldScore, new_score: newScore, change_reason: reason, created_at: new Date().toISOString() }
        });
      } catch (_) {}
    }
    return newScore;
  }

  async upsertSession(userId, sessionId, expiresAt) {
    if (this.db.createSession) {
      const existing = await this.db.getSession?.(sessionId);
      if (!existing) return this.db.createSession(userId, sessionId, expiresAt);
      return existing;
    }
    return null;
  }

  // Profile operations
  async getUserProfile(userId) {
    if (this.db && typeof this.db.getUserProfile === 'function') {
      return await this.db.getUserProfile(userId);
    }
    return null;
  }
  async createUserProfile(userId, profileData) {
    if (this.db && typeof this.db.createUserProfile === 'function') {
      return await this.db.createUserProfile(userId, profileData);
    }
    return null;
  }
  async updateUserProfile(userId, profileData) {
    if (this.db && typeof this.db.updateUserProfile === 'function') {
      return await this.db.updateUserProfile(userId, profileData);
    }
    return null;
  }

  // Onboarding operations
  async saveOnboardingResponse(userId, stepNumber, responseData) {
    if (this.db.saveOnboardingResponse) return this.db.saveOnboardingResponse(userId, stepNumber, responseData);
    return null;
  }
  async getOnboardingResponses(userId) {
    if (this.db.getOnboardingResponses) return this.db.getOnboardingResponses(userId);
    return [];
  }
}

export default UsersRepo;


