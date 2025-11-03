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

/** Bundle Save Endpoint */
export function createBundlesRouter(deps) {
  const router = express.Router();
  const gamification = deps?.gamification;
  
  // Bundle save is rule-based (no AI), so no rate limiting needed
  router.post('/save', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { 
      products, 
      bundle_data, 
      base_premium_total, 
      bundle_discount_percentage, 
      coins_discount_percentage, 
      total_discount_percentage,
      bundle_savings_amount,
      coins_savings_amount,
      total_savings_amount,
      final_price_after_discount
    } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Products array is required' });
    }

    try {
      // Deduct coins based on the bundle discount (1 coin per 1% discount used)
      // For simplicity, deduct coins equal to the total discount percentage
      const coinsToDeduct = Math.min(total_discount_percentage || 0, 100); // Cap at 100 coins max
      
      let user = null;
      let remainingCoins = 0;
      
      if (coinsToDeduct > 0 && gamification && gamification.usersRepo) {
        user = await gamification.usersRepo.getById(userId);
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if ((user.coins || 0) < coinsToDeduct) {
          return res.status(400).json({ 
            success: false, 
            message: `Insufficient coins. Required: ${coinsToDeduct}, Available: ${user.coins || 0}` 
          });
        }
        
        // Deduct coins
        await gamification.usersRepo.update(userId, { 
          coins: Math.max(0, (user.coins || 0) - coinsToDeduct) 
        });
        remainingCoins = Math.max(0, (user.coins || 0) - coinsToDeduct);
      } else if (gamification && gamification.usersRepo) {
        // Still fetch user for remaining coins even if no deduction
        user = await gamification.usersRepo.getById(userId);
        remainingCoins = user?.coins || 0;
      }

      // Save bundle to database
      const { db } = await import('../services/supabase.js');
      
      const bundleRecord = {
        user_id: userId,
        bundle_data: bundle_data || {},
        products: products,
        base_premium_total: base_premium_total || 0,
        bundle_discount_percentage: bundle_discount_percentage || 0,
        coins_discount_percentage: coins_discount_percentage || 0,
        total_discount_percentage: total_discount_percentage || 0,
        bundle_savings_amount: bundle_savings_amount || 0,
        coins_savings_amount: coins_savings_amount || 0,
        total_savings_amount: total_savings_amount || 0,
        final_price_after_discount: final_price_after_discount || 0,
        coins_deducted: coinsToDeduct
      };
      
      try {
        const result = await db.query('user_bundles', { type: 'insert' }, {
          data: bundleRecord
        });
        
        return res.status(201).json({ 
          success: true, 
          message: 'Bundle saved successfully', 
          data: {
            bundle: Array.isArray(result) && result.length > 0 ? result[0] : bundleRecord,
            coins_deducted: coinsToDeduct,
            remaining_coins: remainingCoins
          }
        });
      } catch (dbError) {
        // Log error but still return success (bundle was processed, coins deducted)
        console.error('[Bundle Save] Database error:', dbError);
        return res.status(201).json({ 
          success: true, 
          message: 'Bundle processed (database save failed)', 
          data: {
            bundle_data,
            products,
            coins_deducted: coinsToDeduct,
            remaining_coins: remainingCoins,
            db_error: dbError?.message
          }
        });
      }
    } catch (error) {
      console.error('[Bundle Save] Error:', error);
      return res.status(500).json({ 
        success: false, 
        message: error?.message || 'Failed to save bundle' 
      });
    }
  }));

  return router;
}

export default createRewardsRouter;


