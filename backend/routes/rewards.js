import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';

const router = express.Router();

// Rewards catalog (mock)
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
  const rewards = [
    { id: 'reward-1', title: 'Fuel Voucher', description: 'Save on fuel', coin_cost: 200, xp_reward: 20, category: 'physical', rarity: 'rare', available: true, stock: 50 },
    { id: 'reward-2', title: 'Gym Membership Discount', description: 'Stay fit and save', coin_cost: 300, xp_reward: 30, category: 'experiences', rarity: 'epic', available: true, stock: 20 },
  ];
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
    { id: 'offer-1', title: 'QIC Partner Spa', description: '20% off spa treatments', partner: 'QIC Spa', discount: '20%', valid_until: '2025-12-31', requirements: '500 LifeScore' },
  ];
  res.json({ success: true, data: { offers } });
}));

router.get('/user', authenticateUser, asyncHandler(async (req, res) => {
  const rewards = [
    { id: 'reward-1', title: 'Fuel Voucher', description: 'Save on fuel', category: 'physical', redeemed_at: new Date().toISOString() },
  ];
  res.json({ success: true, data: { rewards } });
}));

router.post('/redeem', authenticateUser, asyncHandler(async (req, res) => {
  const { rewardId } = req.body;
  const sessionId = req.sessionId;
  
  // Deduct coins from user
  const currentStats = await db.getStats(sessionId);
  const coins_deducted = 200; // Fixed cost for MVP
  const updatedStats = await db.upsertStats(sessionId, { 
    coins: Math.max(currentStats.coins - coins_deducted, 0),
    xp: currentStats.xp + 20 // Small XP bonus for redeeming
  });
  
  res.status(201).json({ 
    success: true, 
    message: 'Reward redeemed', 
    data: { 
      reward: { id: rewardId }, 
      updated_user: updatedStats
    } 
  });
}));

export default router;


