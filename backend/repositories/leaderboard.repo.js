// Leaderboard repository; queries users and social_connections in Supabase when available
export class LeaderboardRepo {
  constructor(database) {
    this.db = database;
  }

  async topByLifeScore(limit = 10) {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('users', { type: 'select' }, {
          select: 'id, username, level, lifescore, xp',
          orderBy: { column: 'lifescore', ascending: false },
          limit
        });
        return rows || [];
      } catch (_) {}
    }
    return [
      { id: 'u-top1', username: 'amina', level: 12, lifescore: 90, xp: 1200 },
      { id: 'u-top2', username: 'yusuf', level: 11, lifescore: 87, xp: 1150 }
    ].slice(0, limit);
  }

  async topByXP(limit = 10) {
    if (typeof this.db.query === 'function') {
      try {
        const rows = await this.db.query('users', { type: 'select' }, {
          select: 'id, username, level, lifescore, xp',
          orderBy: { column: 'xp', ascending: false },
          limit
        });
        return rows || [];
      } catch (_) {}
    }
    return [
      { id: 'u-top1', username: 'amina', level: 12, lifescore: 90, xp: 1200 },
      { id: 'u-top2', username: 'yusuf', level: 11, lifescore: 87, xp: 1150 }
    ].slice(0, limit);
  }

  async friendsByUser(userId) {
    if (typeof this.db.query === 'function') {
      try {
        const connections = await this.db.query('social_connections', { type: 'select' }, {
          filters: { user_id: userId }
        });
        const friendIds = connections.map(c => c.friend_id);
        const friends = friendIds.length
          ? await this.db.query('users', { type: 'select' }, { filters: { id: friendIds } })
          : [];
        return friends || [];
      } catch (_) {}
    }
    return [
      { id: 'friend-1', username: 'layla', level: 6, lifescore: 62, current_streak: 4, avatar_url: '' },
      { id: 'friend-2', username: 'omar', level: 8, lifescore: 74, current_streak: 9, avatar_url: '' }
    ];
  }
}

export default LeaderboardRepo;


