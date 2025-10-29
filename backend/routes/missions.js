import express from 'express';
import { validate, validateQuery, missionQuerySchema } from '../middleware/validation.js';
import { startMissionSchema, completeMissionSchema, joinMissionSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { strictRateLimit } from '../middleware/security.js';

/** @param {{ mission: import('../services/mission.service.js').MissionService, product?: import('../services/product.service.js').ProductService }} deps */
export function createMissionsRouter(deps) {
  const router = express.Router();
  const missionService = deps?.mission;
  const productService = deps?.product;
  const achievementService = deps?.achievement;

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
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at,
              completed_at: userMission.completed_at
            } : null
          };
        });

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedMissions = missionsWithProgress.slice(startIndex, endIndex);

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
      res.status(201).json({ success: true, message: 'Mission started' });
    })
  );

  // Complete a mission
  router.post('/complete', 
    authenticateUser,
    strictRateLimit,
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
      res.json({ success: true, data: { ...result.results, achievements_unlocked } });
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

  return router;
}

export default createMissionsRouter;
