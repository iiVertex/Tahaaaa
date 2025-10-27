import express from 'express';
import { validate, aiRecommendationSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { aiService } from '../services/ai.service.js';
import { db } from '../services/supabase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get AI recommendations
router.get('/recommendations', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type = 'mission' } = req.query;

    try {
      // Get user profile for personalized recommendations
      const userProfile = await db.getUserProfile(userId);
      const profileData = userProfile?.profile_json || {};

      // Get AI recommendations
      const recommendations = await aiService.generateMissionRecommendations(userId, profileData);

      // Filter by type if specified
      const filteredRecommendations = type === 'all' 
        ? recommendations 
        : recommendations.filter(rec => rec.type === type);

      logger.info('AI recommendations generated', {
        userId,
        type,
        count: filteredRecommendations.length
      });

      res.json({
        success: true,
        data: {
          recommendations: filteredRecommendations,
          generated_at: new Date().toISOString(),
          type
        }
      });

    } catch (error) {
      logger.error('Error getting AI recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI recommendations',
        error: error.message
      });
    }
  })
);

// Get AI recommendations with context
router.post('/recommendations', 
  authenticateUser,
  validate(aiRecommendationSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { context, type = 'mission' } = req.body;

    try {
      // Get user profile
      const userProfile = await db.getUserProfile(userId);
      const profileData = userProfile?.profile_json || {};

      // Add context to profile for more personalized recommendations
      const contextualProfile = {
        ...profileData,
        context
      };

      // Get AI recommendations
      const recommendations = await aiService.generateMissionRecommendations(userId, contextualProfile);

      // Filter by type if specified
      const filteredRecommendations = type === 'all' 
        ? recommendations 
        : recommendations.filter(rec => rec.type === type);

      logger.info('Contextual AI recommendations generated', {
        userId,
        type,
        context: context?.substring(0, 100), // Log first 100 chars
        count: filteredRecommendations.length
      });

      res.json({
        success: true,
        data: {
          recommendations: filteredRecommendations,
          generated_at: new Date().toISOString(),
          type,
          context
        }
      });

    } catch (error) {
      logger.error('Error getting contextual AI recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI recommendations',
        error: error.message
      });
    }
  })
);

// Generate AI profile
router.post('/profile', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { onboardingData } = req.body;

    try {
      if (!onboardingData) {
        return res.status(400).json({
          success: false,
          message: 'Onboarding data is required'
        });
      }

      // Generate AI profile
      const aiProfile = await aiService.generateAIProfile(onboardingData);

      logger.info('AI profile generated', {
        userId,
        profileKeys: Object.keys(aiProfile)
      });

      res.json({
        success: true,
        data: {
          ai_profile: aiProfile,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error generating AI profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate AI profile',
        error: error.message
      });
    }
  })
);

// Simulate scenario
router.post('/scenarios/simulate', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const scenarioInputs = req.body;

    try {
      if (!scenarioInputs.type) {
        return res.status(400).json({
          success: false,
          message: 'Scenario type is required'
        });
      }

      // Get user profile for context
      const userProfile = await db.getUserProfile(userId);
      const profileData = userProfile?.profile_json || {};

      // Add user context to scenario inputs
      const contextualInputs = {
        ...scenarioInputs,
        user_profile: profileData
      };

      // Get AI prediction
      const prediction = await aiService.predictScenarioOutcome(contextualInputs);

      logger.info('Scenario simulation completed', {
        userId,
        scenarioType: scenarioInputs.type,
        confidence: prediction.confidence
      });

      res.json({
        success: true,
        data: {
          prediction,
          simulated_at: new Date().toISOString(),
          scenario_type: scenarioInputs.type
        }
      });

    } catch (error) {
      logger.error('Error simulating scenario:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to simulate scenario',
        error: error.message
      });
    }
  })
);

// Get AI insights for dashboard
router.get('/insights', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      // Get user profile and stats
      const userProfile = await db.getUserProfile(userId);
      const profileData = userProfile?.profile_json || {};

      // Get user's recent activity
      const userMissions = await db.getUserMissions(userId);
      const recentMissions = userMissions.slice(0, 5);

      // Generate insights based on user data
      const insights = [];

      // LifeScore insights
      const lifescore = profileData.stats?.lifescore || 0;
      if (lifescore < 500) {
        insights.push({
          type: 'lifescore',
          priority: 'high',
          title: 'Boost Your LifeScore',
          message: 'Your LifeScore is below 500. Complete health missions to improve it.',
          action: 'Complete health missions',
          icon: '📈'
        });
      }

      // Streak insights
      const currentStreak = profileData.stats?.current_streak || 0;
      if (currentStreak === 0) {
        insights.push({
          type: 'streak',
          priority: 'medium',
          title: 'Start Your Streak',
          message: 'Complete a mission today to start building your streak.',
          action: 'Start a mission',
          icon: '🔥'
        });
      }

      // Integration insights
      const integrations = profileData.integrations || [];
      if (integrations.includes('QIC Health Portal')) {
        insights.push({
          type: 'integration',
          priority: 'low',
          title: 'Sync Health Data',
          message: 'Connect your QIC Health Portal to get personalized recommendations.',
          action: 'Sync data',
          icon: '🏥'
        });
      }

      // Mission completion insights
      const completedMissions = userMissions.filter(um => um.status === 'completed').length;
      if (completedMissions === 0) {
        insights.push({
          type: 'mission',
          priority: 'high',
          title: 'Complete Your First Mission',
          message: 'Start your journey by completing your first mission.',
          action: 'Browse missions',
          icon: '🎯'
        });
      }

      logger.info('AI insights generated', {
        userId,
        insightCount: insights.length
      });

      res.json({
        success: true,
        data: {
          insights,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting AI insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI insights',
        error: error.message
      });
    }
  })
);

// Get AI chat response (for future AI assistant)
router.post('/chat', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { message, context } = req.body;

    try {
      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Message is required'
        });
      }

      // Get user profile for context
      const userProfile = await db.getUserProfile(userId);
      const profileData = userProfile?.profile_json || {};

      // Mock AI response (replace with real AI service)
      const responses = [
        "I can help you find the perfect mission to boost your LifeScore!",
        "Based on your profile, I recommend focusing on health missions.",
        "Great job on completing your recent missions! Keep it up!",
        "Your streak is looking good! Don't forget to complete a mission today.",
        "I notice you haven't synced your health data yet. Would you like help with that?"
      ];

      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      logger.info('AI chat response generated', {
        userId,
        messageLength: message.length,
        context
      });

      res.json({
        success: true,
        data: {
          response: randomResponse,
          timestamp: new Date().toISOString(),
          context
        }
      });

    } catch (error) {
      logger.error('Error getting AI chat response:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI response',
        error: error.message
      });
    }
  })
);

export default router;
