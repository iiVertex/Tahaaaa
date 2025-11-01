export class UserRewardsRepo {
  constructor(database) {
    this.db = database;
  }

  async redeemReward(userId, rewardId, extraData = {}) {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('user_rewards', { type: 'insert' }, {
          data: { 
            user_id: userId, 
            reward_id: rewardId, 
            redeemed_at: new Date().toISOString(),
            ...extraData
          }
        });
        return rows?.[0] || { user_id: userId, reward_id: rewardId, ...extraData };
      } catch (_) {}
    }
    return { id: rewardId, user_id: userId, reward_id: rewardId, redeemed_at: new Date().toISOString(), ...extraData };
  }

  async listByUser(userId) {
    if (typeof this.db.query === 'function') {
      try {
        return await this.db.query('user_rewards', { type: 'select' }, {
          filters: { user_id: userId },
          orderBy: { column: 'redeemed_at', ascending: false }
        });
      } catch (_) {}
    }
    return [];
  }
  
  // Alias for listByUser (for route compatibility)
  async getByUser(userId) {
    return this.listByUser(userId);
  }
}

export default UserRewardsRepo;


