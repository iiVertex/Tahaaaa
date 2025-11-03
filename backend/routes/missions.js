import express from 'express';
import { validate, validateQuery, missionQuerySchema } from '../middleware/validation.js';
import { startMissionSchema, completeMissionSchema, joinMissionSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { rateLimit } from 'express-rate-limit';
import { strictRateLimit, dailyTokenLimit, missionCompletionRateLimit } from '../middleware/security.js';

/** @param {{ mission: import('../services/mission.service.js').MissionService, product?: import('../services/product.service.js').ProductService }} deps */
export function createMissionsRouter(deps) {
  const router = express.Router();
  const missionService = deps?.mission;
  const productService = deps?.product;
  const achievementService = deps?.achievement;

  // Rate limiter for daily mission generation (10 requests per hour)
  const dailyMissionRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many daily mission generations. Please wait an hour.' }
  });

  // Get all missions with filters
  router.get('/', 
    authenticateUser,
    validateQuery(missionQuerySchema),
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { category, difficulty, status, page = 1, limit = 10 } = req.query;

      try {
        const filters = {};
        if (category) filters.category = category;
        if (difficulty) filters.difficulty = difficulty;
        if (status) filters.status = status;

        const { missions, userProgress } = await missionService.listMissions(filters, userId);
        const userMissionMap = new Map(userProgress.map(um => [um.mission_id, um]));

        const missionsWithProgress = missions.map(mission => {
          const userMission = userMissionMap.get(mission.id);
          return {
            ...mission,
            product_spotlight: productService ? productService.getProductSpotlight(mission.category) : undefined,
            user_progress: userMission ? {
              status: userMission.status || 'available',
              progress: userMission.progress || 0,
              started_at: userMission.started_at,
              completed_at: userMission.completed_at,
              // Include rewards for completed missions (for Achievements display)
              coins_earned: userMission.coins_earned,
              xp_earned: userMission.xp_earned,
              lifescore_change: userMission.lifescore_change
            } : {
              status: 'available',
              progress: 0,
              started_at: null,
              completed_at: null
            }
          };
        });

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedMissions = missionsWithProgress.slice(startIndex, endIndex);
        
        // All missions are accessible - no initial stage gating

        res.json({
          success: true,
          data: {
            missions: paginatedMissions,
            pagination: {
              page,
              limit,
              total: missions.length,
              pages: Math.ceil(missions.length / limit)
            }
          }
        });

      } catch (error) {
        logger.error('Error getting missions:', error);
        res.status(500).json({ success: false, message: 'Failed to get missions', error: error.message });
      }
    })
  );

  // Get single mission by ID
  router.get('/:missionId', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { missionId } = req.params;
      const userId = req.user.id;

      try {
        const { missions } = await missionService.listMissions({}, userId);
        const mission = missions.find(m => m.id === missionId) || null;
        if (!mission) {
          return res.status(404).json({ success: false, message: 'Mission not found' });
        }

        const { userProgress } = await missionService.listMissions({}, userId);
        const userMission = userProgress.find(um => um.mission_id === missionId) || null;

        res.json({
          success: true,
          data: {
            ...mission,
            user_progress: userMission ? {
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at,
              completed_at: userMission.completed_at
            } : null
          }
        });

      } catch (error) {
        logger.error('Error getting mission:', error);
        res.status(500).json({ success: false, message: 'Failed to get mission', error: error.message });
      }
    })
  );

  // Generate personalized missions for user
  router.post('/generate', 
    authenticateUser,
    dailyTokenLimit, // Daily token limit (50 AI calls per day)
    strictRateLimit,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      // CRITICAL: Deduct coins BEFORE AI API call (10 coins for mission generation)
      const coinCost = 10;
      const { container } = await import('../di/container.js');
      const user = await container.repos.users.getById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      
      const currentCoins = user.coins || 0;
      if (currentCoins < coinCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient coins. Required: ${coinCost}, Current: ${currentCoins}`,
          required: coinCost,
          current: currentCoins
        });
      }
      
      // Deduct coins
      await container.repos.users.update(userId, {
        coins: Math.max(0, currentCoins - coinCost)
      });
      
      logger.info('Coins deducted for AI mission generation', {
        userId,
        coinCost,
        previousCoins: currentCoins,
        newCoins: currentCoins - coinCost
      });

      let result;
      try {
        result = await missionService.generateMissions(userId);
      } catch (aiError) {
        const errorMsg = aiError?.message || 'AI API unavailable';
        if (errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API')) {
          logger.warn('AI API unavailable for mission generation', { error: errorMsg });
          return res.status(503).json({
            success: false,
            message: 'AI service temporarily unavailable. Mission generation disabled. Please try again later.',
            error: errorMsg,
            disabled: true
          });
        }
        throw aiError;
      }
      
      if (!result.ok) {
        return res.status(result.status || 500).json({ success: false, message: result.message });
      }
      res.status(201).json({ success: true, data: { missions: result.missions || [] } });
    })
  );

  // Start a mission
  router.post('/start', 
    authenticateUser,
    strictRateLimit,
    validate(startMissionSchema),
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { missionId } = req.body;

      const result = await missionService.startMission(userId, missionId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      res.status(201).json({ 
        success: true, 
        message: 'Mission started',
        data: { steps: result.steps || [] }
      });
    })
  );

  // Complete a mission
  router.post('/complete', 
    authenticateUser,
    missionCompletionRateLimit, // Use more lenient rate limit for mission completion
    validate(completeMissionSchema),
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { missionId, completionData } = req.body;

      const result = await missionService.completeMission(userId, missionId, completionData);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, message: result.message });
      }
      // Achievement auto-check
      let achievements_unlocked = [];
      if (achievementService) {
        try {
          const stats = await achievementService.getUserStats(userId);
          const unlocked = await achievementService.checkAndUnlockAchievements(userId, 'mission_complete', stats);
          achievements_unlocked = (unlocked || []).map(a => ({ id: a.id, name_en: a.name_en, xp_reward: a.xp_reward, coin_reward: a.coin_reward }));
        } catch (_) {}
      }
      
      // Get updated user coins after completion
      const { container } = await import('../di/container.js');
      const updatedUser = await container.repos.users.getById(userId);
      
      res.json({ 
        success: true, 
        data: { 
          ...result.results, 
          achievements_unlocked,
          coins: updatedUser?.coins || 0,
          xp: updatedUser?.xp || 0,
          level: updatedUser?.level || 1
        } 
      });
    })
  );

  // Join a collaborative mission
  router.post('/join', 
    authenticateUser,
    validate(joinMissionSchema),
    asyncHandler(async (req, res) => {
      const { missionId } = req.body;
      const userId = req.user.id;

      try {
        const { missions } = await missionService.listMissions({}, userId);
        const mission = missions.find(m => m.id === missionId) || null;
        if (!mission) {
          return res.status(404).json({ success: false, message: 'Mission not found' });
        }
        if (!mission.is_collaborative) {
          return res.status(400).json({ success: false, message: 'Mission is not collaborative' });
        }

        const { userProgress } = await missionService.listMissions({}, userId);
        const existingMission = userProgress.find(um => um.mission_id === missionId);
        if (existingMission) {
          return res.status(409).json({ success: false, message: 'Already joined this mission' });
        }

        await missionService.startMission(userId, missionId);

        logger.info('Joined collaborative mission', { userId, missionId, missionTitle: mission.title_en });

        res.status(201).json({
          success: true,
          message: 'Joined mission successfully',
          data: { missionId, status: 'active', joined_at: new Date().toISOString() }
        });

      } catch (error) {
        logger.error('Error joining mission:', error);
        res.status(500).json({ success: false, message: 'Failed to join mission', error: error.message });
      }
    })
  );

  // Get user's active missions
  router.get('/user/active', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const { userProgress, missions } = await missionService.listMissions({}, userId);
        const active = userProgress.filter(um => um.status === 'active');
        const missionsWithDetails = active.map(userMission => {
          const mission = missions.find(m => m.id === userMission.mission_id) || {};
          return {
            ...mission,
            user_progress: {
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at
            }
          };
        });

        res.json({ success: true, data: missionsWithDetails });

      } catch (error) {
        logger.error('Error getting active missions:', error);
        res.status(500).json({ success: false, message: 'Failed to get active missions', error: error.message });
      }
    })
  );

  // Get user's completed missions
  router.get('/user/completed', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const { userProgress, missions } = await missionService.listMissions({}, userId);
        const completed = userProgress.filter(um => um.status === 'completed');
        const missionsWithDetails = completed.map(userMission => {
          const mission = missions.find(m => m.id === userMission.mission_id) || {};
          return {
            ...mission,
            user_progress: {
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at,
              completed_at: userMission.completed_at
            }
          };
        });

        res.json({ success: true, data: missionsWithDetails });

      } catch (error) {
        logger.error('Error getting completed missions:', error);
        res.status(500).json({ success: false, message: 'Failed to get completed missions', error: error.message });
      }
    })
  );

  // Get mission steps for a user mission
  router.get('/:missionId/steps', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { missionId } = req.params;

      try {
        // Get user's active mission for this missionId
        const { userProgress, missions } = await missionService.listMissions({}, userId);
        
        // Try to find mission by mission_id (UUID) first
        let userMission = userProgress.find(um => um.mission_id === missionId && (um.status === 'active' || um.status === 'completed'));
        
        // If not found, try to match by checking if missionId is a temporary ID from daily missions
        // Daily missions use format: daily-easy-{timestamp}, daily-medium-{timestamp}, daily-hard-{timestamp}
        if (!userMission && (missionId.startsWith('daily-easy-') || missionId.startsWith('daily-medium-') || missionId.startsWith('daily-hard-'))) {
          // Extract difficulty from temporary ID
          const difficulty = missionId.includes('easy') ? 'easy' : missionId.includes('hard') ? 'hard' : 'medium';
          
          // Find the most recent active mission with matching difficulty that was started today
          const today = new Date().toISOString().split('T')[0];
          userMission = userProgress.find(um => {
            const mission = missions.find(m => m.id === um.mission_id);
            return mission && 
                   mission.difficulty === difficulty && 
                   (um.status === 'active' || um.status === 'completed') &&
                   um.started_at && 
                   um.started_at.startsWith(today);
          });
        }
        
        // If still not found, try to find any active mission for this user (fallback)
        if (!userMission) {
          // Log for debugging
          logger.warn('Mission steps lookup failed', { 
            userId, 
            missionId, 
            availableUserMissions: userProgress.map(um => ({ 
              mission_id: um.mission_id, 
              status: um.status 
            })) 
          });
          return res.status(404).json({ success: false, message: 'Mission not found or not started' });
        }

        // Get steps from missionStepsRepo via container
        const { container } = await import('../di/container.js');
        let steps = [];
        try {
          if (container.repos.missionSteps?.getByUserMission) {
            steps = await container.repos.missionSteps.getByUserMission(userMission.id);
          } else if (container.repos.missionSteps?.list) {
            // Fallback: query by user_mission_id
            steps = await container.repos.missionSteps.list({ user_mission_id: userMission.id });
          }
        } catch (stepError) {
          logger.warn('Error fetching mission steps, returning empty array', { error: stepError?.message });
          steps = [];
        }

        // Sort by step_number and ensure structure
        steps = (steps || []).map(s => ({
          step_number: s.step_number || s.stepNumber || 1,
          title: s.title || s.title_en || `Step ${s.step_number || 1}`,
          description: s.description || s.description_en || ''
        })).sort((a, b) => a.step_number - b.step_number);

        res.json({ success: true, data: { steps: steps } });

      } catch (error) {
        logger.error('Error getting mission steps:', error);
        res.status(500).json({ success: false, message: 'Failed to get mission steps', error: error.message });
      }
    })
  );

  // Get daily brief
  router.get('/daily-brief',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { container } = await import('../di/container.js');
      const aiService = container.services.ai;
      const profileService = container.services.profile;

      try {
        // Get user profile
        const profile = await profileService?.getProfile?.(userId);
        if (!profile || !profile.userProfile) {
          return res.status(404).json({ success: false, message: 'User profile not found' });
        }

        // Generate daily brief using AI
        const dailyBrief = await aiService?.generateDailyBrief?.(userId, profile.userProfile) || 'Welcome back! Ready for today\'s missions?';

        res.json({ success: true, data: { daily_brief: dailyBrief } });
      } catch (error) {
        logger.error('Error getting daily brief:', error);
        res.status(500).json({ success: false, message: 'Failed to get daily brief', error: error.message });
      }
    })
  );

  // Generate/reset daily adaptive missions
  router.post('/generate-daily',
    authenticateUser,
    dailyMissionRateLimit, // Max 10 requests per hour
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const result = await missionService.resetDailyMissions(userId);
        
        if (!result.ok) {
          return res.status(result.status || 500).json({ 
            success: false, 
            message: result.message || 'Failed to generate daily missions' 
          });
        }

        res.json({ 
          success: true, 
          data: { 
            missions: result.missions || [],
            alreadyReset: result.alreadyReset || false 
          } 
        });
      } catch (error) {
        logger.error('Error generating daily missions:', error);
        res.status(500).json({ success: false, message: 'Failed to generate daily missions', error: error.message });
      }
    })
  );

  return router;
}

export default createMissionsRouter;