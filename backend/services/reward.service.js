import { logger } from '../utils/logger.js';

export class RewardService {
  // deps.repos: { rewards, users, userRewards, analytics }
  constructor(deps = {}) {
    this.rewardsRepo = deps.rewards;
    this.usersRepo = deps.users;
    this.userRewardsRepo = deps.userRewards;
    this.analyticsRepo = deps.analytics;
  }

  async listActiveRewards() {
    return this.rewardsRepo.listActive();
  }

  async redeem(userId, rewardId) {
    const reward = await this.rewardsRepo.getById(rewardId);
    if (!reward) {
      return { ok: false, status: 404, message: 'Reward not found' };
    }

    const user = await this.usersRepo.getById(userId);
    if (!user) {
      return { ok: false, status: 404, message: 'User not found' };
    }
    if ((user.coins || 0) < reward.coins_cost) {
      return { ok: false, status: 400, message: 'Insufficient coins' };
    }

    const newCoins = Math.max(0, (user.coins || 0) - reward.coins_cost);
    await this.usersRepo.update(userId, { coins: newCoins, xp: (user.xp || 0) + (reward.xp_reward || 0) });
    await this.userRewardsRepo.redeemReward(userId, rewardId);
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'reward_redeemed', event_data: { reward_id: rewardId }, created_at: new Date().toISOString() });

    logger.info('Reward redeemed', { userId, rewardId, coinsCost: reward.coins_cost });
    return { ok: true, data: { reward: { id: rewardId }, user: { ...user, coins: newCoins } } };
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const rewardService = undefined;


