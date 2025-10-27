import express from 'express';
import { validate, validateQuery, missionQuerySchema } from '../middleware/validation.js';
import { startMissionSchema, completeMissionSchema, joinMissionSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';
import { gamificationService } from '../services/gamification.service.js';
import { aiService } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all missions with filters
router.get('/', 
  authenticateUser,
  validateQuery(missionQuerySchema),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { category, difficulty, status, page = 1, limit = 10 } = req.query;

    try {
      // Build filters
      const filters = {};
      if (category) filters.category = category;
      if (difficulty) filters.difficulty = difficulty;
      if (status) filters.status = status;

      // Get missions
      const missions = await db.getMissions(filters);
      
      // Get user's mission progress
      const userMissions = await db.getUserMissions(userId);
      const userMissionMap = new Map();
      userMissions.forEach(um => {
        userMissionMap.set(um.mission_id, um);
      });

      // Combine mission data with user progress
      const missionsWithProgress = missions.map(mission => {
        const userMission = userMissionMap.get(mission.id);
        return {
          ...mission,
          user_progress: userMission ? {
            status: userMission.status,
            progress: userMission.progress,
            started_at: userMission.started_at,
            completed_at: userMission.completed_at
          } : null
        };
      });

      // Pagination
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
      res.status(500).json({
        success: false,
        message: 'Failed to get missions',
        error: error.message
      });
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
      const mission = await db.getMissionById(missionId);
      
      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Mission not found'
        });
      }

      // Get user's progress for this mission
      const userMissions = await db.getUserMissions(userId, null);
      const userMission = userMissions.find(um => um.mission_id === missionId);

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
      res.status(500).json({
        success: false,
        message: 'Failed to get mission',
        error: error.message
      });
    }
  })
);

// Start a mission
router.post('/start', 
  authenticateUser,
  validate(startMissionSchema),
  asyncHandler(async (req, res) => {
    const { missionId } = req.body;
    const sessionId = req.sessionId;

    try {
      // Check if mission exists
      const mission = await db.getMissionById(missionId);
      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Mission not found'
        });
      }

      // Check if user already has this mission active
      const userMissions = await db.getUserMissions(sessionId, 'active');
      const existingMission = userMissions.find(um => um.mission_id === missionId);
      
      if (existingMission) {
        return res.status(409).json({
          success: false,
          message: 'Mission already started'
        });
      }

      // Start the mission
      await db.startMission(sessionId, missionId);

      // Get updated user stats
      const updatedUser = await db.getStats(sessionId);

      logger.info('Mission started', {
        sessionId,
        missionId,
        missionTitle: mission.title_en
      });

      res.status(201).json({
        success: true,
        message: 'Mission started successfully',
        data: {
          mission: { id: missionId, status: 'active' },
          updated_user: updatedUser
        }
      });

    } catch (error) {
      logger.error('Error starting mission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start mission',
        error: error.message
      });
    }
  })
);

// Complete a mission
router.post('/complete', 
  authenticateUser,
  validate(completeMissionSchema),
  asyncHandler(async (req, res) => {
    const { missionId, completionData } = req.body;
    const sessionId = req.sessionId;

    try {
      // Check if mission exists
      const mission = await db.getMissionById(missionId);
      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Mission not found'
        });
      }

      // Check if user has this mission active
      const userMissions = await db.getUserMissions(sessionId, 'active');
      const userMission = userMissions.find(um => um.mission_id === missionId);
      
      if (!userMission) {
        return res.status(400).json({
          success: false,
          message: 'Mission not started or already completed'
        });
      }

      // Complete the mission
      await db.completeMission(sessionId, missionId, completionData);

      // Award XP, coins, and update LifeScore
      const currentStats = await db.getStats(sessionId);
      const updatedStats = await db.upsertStats(sessionId, {
        xp: currentStats.xp + (mission.xp_reward || 50),
        coins: currentStats.coins + (mission.coin_reward || 20),
        lifescore: currentStats.lifescore + (mission.lifescore_impact || 10)
      });

      logger.info('Mission completed', {
        sessionId,
        missionId,
        missionTitle: mission.title_en,
        rewards: { xp: mission.xp_reward, coins: mission.coin_reward, lifescore: mission.lifescore_impact }
      });

      res.json({
        success: true,
        message: 'Mission completed successfully',
        data: {
          mission: { id: missionId, status: 'completed' },
          updated_user: updatedStats
        }
      });

    } catch (error) {
      logger.error('Error completing mission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete mission',
        error: error.message
      });
    }
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
      // Check if mission exists and is collaborative
      const mission = await db.getMissionById(missionId);
      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Mission not found'
        });
      }

      if (!mission.is_collaborative) {
        return res.status(400).json({
          success: false,
          message: 'Mission is not collaborative'
        });
      }

      // Check if mission is full
      const userMissions = await db.getUserMissions(userId, 'active');
      const existingMission = userMissions.find(um => um.mission_id === missionId);
      
      if (existingMission) {
        return res.status(409).json({
          success: false,
          message: 'Already joined this mission'
        });
      }

      // TODO: Check max participants
      // This would require additional database queries

      // Join the mission
      await db.startMission(userId, missionId);

      logger.info('Joined collaborative mission', {
        userId,
        missionId,
        missionTitle: mission.title_en
      });

      res.status(201).json({
        success: true,
        message: 'Joined mission successfully',
        data: {
          missionId,
          status: 'active',
          joined_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error joining mission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join mission',
        error: error.message
      });
    }
  })
);

// Get user's active missions
router.get('/user/active', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const userMissions = await db.getUserMissions(userId, 'active');
      
      // Get mission details for each user mission
      const missionsWithDetails = await Promise.all(
        userMissions.map(async (userMission) => {
          const mission = await db.getMissionById(userMission.mission_id);
          return {
            ...mission,
            user_progress: {
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at
            }
          };
        })
      );

      res.json({
        success: true,
        data: missionsWithDetails
      });

    } catch (error) {
      logger.error('Error getting active missions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active missions',
        error: error.message
      });
    }
  })
);

// Get user's completed missions
router.get('/user/completed', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const userMissions = await db.getUserMissions(userId, 'completed');
      
      // Get mission details for each user mission
      const missionsWithDetails = await Promise.all(
        userMissions.map(async (userMission) => {
          const mission = await db.getMissionById(userMission.mission_id);
          return {
            ...mission,
            user_progress: {
              status: userMission.status,
              progress: userMission.progress,
              started_at: userMission.started_at,
              completed_at: userMission.completed_at
            }
          };
        })
      );

      res.json({
        success: true,
        data: missionsWithDetails
      });

    } catch (error) {
      logger.error('Error getting completed missions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get completed missions',
        error: error.message
      });
    }
  })
);

export default router;
