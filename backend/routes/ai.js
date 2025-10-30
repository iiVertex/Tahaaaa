import express from 'express';
import { validate, aiRecommendationSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
// Use DI-injected ai service via factory
import { strictRateLimit } from '../middleware/security.js';
// Use DI-injected profile service via factory
import { logger } from '../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

/** @param {{ ai: any, profile: import('../services/profile.service.js').ProfileService, product?: import('../services/product.service.js').ProductService }} deps */
export function createAiRouter(deps) {
  const router = express.Router();
  const aiService = deps?.ai;
  const profileService = deps?.profile;
  const productService = deps?.product;

  router.get('/recommendations', 
  authenticateUser,
  ...(isDev ? [] : [strictRateLimit]),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { type = 'mission' } = req.query;

    try {
      const composite = await profileService.getProfile(userId);
      const profileData = composite?.userProfile?.profile_json || {};

      const [insights, suggestedMissionsRaw] = await Promise.all([
        aiService.predictInsights(userId),
        aiService.recommendAdaptiveMissions(userId, profileData)
      ]);

      const suggestedMissions = (suggestedMissionsRaw || []).map((m) => ({
        ...m,
        ai_rationale: m.reason || 'Recommended for your profile',
        product_spotlight: productService ? productService.getProductSpotlight(m.category) : undefined
      }));

      logger.info('AI recommendations generated', {
        userId,
        type,
        insights: insights?.length || 0,
        missions: suggestedMissions?.length || 0
      });

      let productRecommendations = [];
      try {
        if (productService) {
          const eligibles = await productService.getEligibleProducts(userId);
          const top = eligibles.filter((p) => p.eligible).slice(0, 3);
          const ids = top.map((p) => p.id);
          const bundle = productService.calculateBundleSavings(ids);
          productRecommendations = top.map((p) => ({
            product_id: p.id,
            name: p.name,
            type: p.type,
            estimated_premium: p.base_premium,
            savings_if_bundled: Math.round((bundle?.savings_percent || 0) * 100),
            rationale: 'Based on your profile and recent activity.',
            cta: 'Get Quote'
          }));
        }
      } catch (e) {
        logger.warn('AI product recommendations fallback', { error: e?.message });
      }

      res.json({
        success: true,
        data: {
          insights,
          suggested_missions: suggestedMissions,
          product_recommendations: productRecommendations,
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
  }))

  // Get AI recommendations with context
  router.post('/recommendations', 
  authenticateUser,
  strictRateLimit,
  validate(aiRecommendationSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { context, type = 'mission' } = req.body;

    try {
      const composite = await profileService.getProfile(userId);
      const profileData = composite?.userProfile?.profile_json || {};
      const contextualProfile = { ...profileData, context };
      const [insights, suggestedMissions] = await Promise.all([
        aiService.predictInsights(userId),
        aiService.recommendAdaptiveMissions(userId, contextualProfile)
      ]);

      logger.info('Contextual AI recommendations generated', {
        userId,
        type,
        context: context?.substring(0, 100),
        insights: insights?.length || 0,
        missions: suggestedMissions?.length || 0
      });

      res.json({
        success: true,
        data: {
          insights,
          suggested_missions: suggestedMissions,
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
  }))

  // Generate AI profile
  router.post('/profile', 
  authenticateUser,
  strictRateLimit,
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
  }))

  // Simulate scenario
  router.post('/scenarios/simulate', 
  authenticateUser,
  strictRateLimit,
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

      const composite = await profileService.getProfile(userId);
      const profileData = composite?.userProfile?.profile_json || {};
      const contextualInputs = { ...scenarioInputs, user_profile: profileData };
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
  }))

  // Get AI insights for dashboard
  router.get('/insights', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const composite = await profileService.getProfile(userId);
      const profileData = composite?.userProfile?.profile_json || {};
      const userMissions = [];
      const recentMissions = [];
      const insights = [];
      const lifescore = composite?.stats?.lifescore || 0;
      if (lifescore < 50) {
        insights.push({
          type: 'lifescore',
          priority: 'high',
          title: 'Boost Your LifeScore',
          message: 'Your LifeScore is below 50. Complete health missions to improve it.',
          action: 'Complete health missions',
          icon: '📈'
        });
      }
      const currentStreak = composite?.stats?.current_streak || 0;
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

      logger.info('AI insights generated', { userId, insightCount: insights.length });

      res.json({ success: true, data: { insights, generated_at: new Date().toISOString() } });

    } catch (error) {
      logger.error('Error getting AI insights:', error);
      res.status(500).json({ success: false, message: 'Failed to get AI insights', error: error.message });
    }
  }));

  router.post('/chat', 
    authenticateUser,
    strictRateLimit,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { message, context } = req.body;

      try {
        if (!message) {
          return res.status(400).json({ success: false, message: 'Message is required' });
        }
        const composite = await profileService.getProfile(userId);
        const profileData = composite?.userProfile?.profile_json || {};
        const responses = [
          "I can help you find the perfect mission to boost your LifeScore!",
          "Based on your profile, I recommend focusing on health missions.",
          "Great job on completing your recent missions! Keep it up!",
          "Your streak is looking good! Don't forget to complete a mission today.",
          "I notice you haven't synced your health data yet. Would you like help with that?"
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        logger.info('AI chat response generated', { userId, messageLength: message.length, context });
        res.json({ success: true, data: { response: randomResponse, timestamp: new Date().toISOString(), context, profile_used: Object.keys(profileData).length } });

      } catch (error) {
        logger.error('Error getting AI chat response:', error);
        res.status(500).json({ success: false, message: 'Failed to get AI response', error: error.message });
      }
    }));

  return router;
}

export default createAiRouter;
