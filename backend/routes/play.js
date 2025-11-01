import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { rateLimit } from 'express-rate-limit';

/** @param {{ play: import('../services/play.service.js').PlayService, ai: import('../services/ai.service.js').AIService, profile: import('../services/profile.service.js').ProfileService }} deps */
export function createPlayRouter(deps) {
  const router = express.Router();
  const playService = deps?.play;
  const aiService = deps?.ai;
  const profileService = deps?.profile;

  // Rate limiter for roulette spins (3 spins per minute)
  const rouletteRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { success: false, message: 'Too many spins. Please wait a minute.' }
  });

  // Get remaining spins for today
  router.get('/roulette/spins-remaining',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      
      try {
        const result = await playService?.getRemainingSpins?.(userId) || { remaining: 3, canSpin: true, spinCount: 0, maxSpins: 3 };
        res.json({ success: true, data: result });
      } catch (error) {
        logger.error('Error getting remaining spins:', error);
        res.status(500).json({ success: false, message: 'Failed to get remaining spins', error: error.message });
      }
    })
  );

  // Spin the roulette wheel
  router.post('/roulette/spin',
    authenticateUser,
    rouletteRateLimit, // Max 3 spins per minute (additional to daily limit)
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        // Check spin limit first
        const { canSpin, remaining } = await playService?.getRemainingSpins?.(userId) || { canSpin: true, remaining: 3 };
        
        if (!canSpin) {
          return res.status(429).json({ 
            success: false, 
            message: 'Daily spin limit reached (3 spins/day). Try again tomorrow!' 
          });
        }

        // Get user profile for AI personalization
        const profile = await profileService?.getProfile?.(userId);
        if (!profile || !profile.userProfile) {
          return res.status(404).json({ success: false, message: 'User profile not found' });
        }

        // Generate roulette content using AI
        const rouletteData = await aiService?.generateRoadTripRoulette?.(userId, profile.userProfile) || {
          wheel_spin_result: 'Doha Adventure',
          itinerary: [],
          ctas: [],
          reward: '100 QIC Coins',
          coins_earned: 100,
          xp_earned: 50
        };

        // Record the spin
        const result = await playService?.recordRouletteSpin?.(userId, rouletteData);
        
        if (!result.ok) {
          return res.status(result.status || 500).json({ 
            success: false, 
            message: result.message || 'Failed to record spin' 
          });
        }

        res.json({ 
          success: true, 
          data: { 
            ...rouletteData,
            remaining: result.remaining,
            spinCount: result.spinCount || 0
          } 
        });
      } catch (error) {
        logger.error('Error spinning roulette:', error);
        res.status(500).json({ success: false, message: 'Failed to spin roulette', error: error.message });
      }
    })
  );

  return router;
}

export default createPlayRouter;

