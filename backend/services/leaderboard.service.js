import LeaderboardRepo from '../repositories/leaderboard.repo.js';

export class LeaderboardService {
  constructor(repo = new LeaderboardRepo()) {
    this.repo = repo;
  }

  topByLifeScore(limit = 10) {
    return this.repo.topByLifeScore(limit);
  }

  topByXP(limit = 10) {
    return this.repo.topByXP(limit);
  }

  friendsList(userId) {
    return this.repo.friendsByUser(userId);
  }
}

export const leaderboardService = new LeaderboardService();


