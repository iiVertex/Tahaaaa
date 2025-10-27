export class UserRewardsRepo {
  constructor(database) {
    this.db = database;
  }

  async redeemReward(userId, rewardId) {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('user_rewards', { type: 'insert' }, {
          data: { user_id: userId, reward_id: rewardId, redeemed_at: new Date().toISOString() }
        });
        return rows?.[0] || { user_id: userId, reward_id: rewardId };
      } catch (_) {}
    }
    return { id: rewardId, user_id: userId, redeemed_at: new Date().toISOString() };
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
}

export default UserRewardsRepo;


