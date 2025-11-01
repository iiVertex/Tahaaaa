import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { strictRateLimit } from '../middleware/security.js';

/** @param {{ reward: import('../services/reward.service.js').RewardService }} deps */
export function createRewardsRouter(deps) {
  const router = express.Router();
  const rewardService = deps?.reward;

  // Rewards catalog
  router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Check if rewardService is available
    if (!rewardService) {
      return res.status(500).json({ success: false, message: 'Rewards service not available' });
    }
    
    let rewards = [];
    try {
      rewards = await rewardService.listActiveRewards();
      // Ensure rewards is an array
      if (!Array.isArray(rewards)) {
        rewards = [];
      }
    } catch (error) {
      console.error('[Rewards Route] Error fetching rewards:', error);
      // Return empty array on error rather than crashing
      rewards = [];
    }
    
    // Get user's redeemed rewards to mark which ones are already purchased
    let redeemedRewardIds = [];
    try {
      if (rewardService.userRewardsRepo && rewardService.userRewardsRepo.getByUser) {
        const userRewards = await rewardService.userRewardsRepo.getByUser(userId);
        redeemedRewardIds = (userRewards || []).map(ur => ur.reward_id || ur.id);
      }
    } catch (error) {
      console.warn('[Rewards Route] Error fetching user rewards:', error.message);
      // Continue even if user rewards fetch fails
    }
    
    // Mark rewards as redeemed
    const rewardsWithStatus = rewards.map(reward => ({
      ...reward,
      is_redeemed: redeemedRewardIds.includes(reward.id),
      coupon_code: reward.coupon_code || undefined // Include coupon code if available
    }));
    
    res.json({ success: true, data: { rewards: rewardsWithStatus } });
  }));

  router.get('/badges', authenticateUser, asyncHandler(async (req, res) => {
    const badges = [
      { id: 'badge-1', title: 'Starter', description: 'Complete first mission', xp_reward: 25, rarity: 'common' },
      { id: 'badge-2', title: 'Health Hero', description: 'Finish 5 health missions', xp_reward: 100, rarity: 'rare' },
    ];
    res.json({ success: true, data: { badges } });
  }));

  router.get('/offers', authenticateUser, asyncHandler(async (req, res) => {
    const offers = [
      { id: 'offer-1', title: 'QIC Partner Spa', description: '20% off spa treatments', partner: 'QIC Spa', discount: '20%', valid_until: '2025-12-31', requirements: '50 LifeScore' },
    ];
    res.json({ success: true, data: { offers } });
  }));

  router.get('/user', authenticateUser, asyncHandler(async (req, res) => {
    const rewards = [
      { id: 'reward-1', title: 'Fuel Voucher', description: 'Save on fuel', category: 'physical', redeemed_at: new Date().toISOString() },
    ];
    res.json({ success: true, data: { rewards } });
  }));

  router.post('/redeem', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
    const { rewardId } = req.body;
    const userId = req.user.id;
    const result = await rewardService.redeem(userId, rewardId);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(201).json({ success: true, message: 'Reward redeemed', data: result.data });
  }));

  return router;
}

export default createRewardsRouter;


