// Rewards repository: uses Supabase when available, else falls back to mock list
export class RewardsRepo {
  constructor(database) {
    this.db = database;
  }

  async listActive() {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('rewards', { type: 'select' }, {
          filters: { is_active: true },
          orderBy: { column: 'created_at', ascending: false },
        });
        return rows || [];
      } catch (_) {}
    }
    // Fallback mock
    return [
      { id: 'reward-1', title: 'Fuel Voucher', description: 'Save on fuel', coins_cost: 200, xp_reward: 20, category: 'physical', rarity: 'rare', available: true, stock: 50 },
      { id: 'reward-2', title: 'Gym Membership Discount', description: 'Stay fit and save', coins_cost: 300, xp_reward: 30, category: 'experiences', rarity: 'epic', available: true, stock: 20 }
    ];
  }

  async getById(rewardId) {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('rewards', { type: 'select' }, { filters: { id: rewardId } });
        return rows?.[0] || null;
      } catch (_) {}
    }
    const list = await this.listActive();
    return list.find(r => r.id === rewardId) || null;
  }
}

export default RewardsRepo;


