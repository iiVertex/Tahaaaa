import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { rewardService as rewardServiceSingleton } from '../services/reward.service.js';
import { strictRateLimit } from '../middleware/security.js';

const router = express.Router();

// Rewards catalog (mock)
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
  const rewards = await rewardServiceSingleton.listActiveRewards();
  res.json({ success: true, data: { rewards } });
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
  const result = await rewardServiceSingleton.redeem(userId, rewardId);
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }
  res.status(201).json({ success: true, message: 'Reward redeemed', data: result.data });
}));

export default router;

// Factory (DI-friendly) export for future use
/** @param {{ rewardService: import('../services/reward.service.js').RewardService }} deps */
export function createRewardsRouter(deps) {
  return router;
}


