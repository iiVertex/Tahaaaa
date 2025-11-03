import express from 'express';
import { validate, aiRecommendationSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
// Use DI-injected ai service via factory
import { strictRateLimit, dailyTokenLimit } from '../middleware/security.js';
// Use DI-injected profile service via factory
import { logger } from '../utils/logger.js';
import { container } from '../di/container.js';

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
          // Calculate bundle savings without coins discount for recommendations (can be added later if needed)
          const bundle = productService.calculateBundleSavings(ids, null);
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
  dailyTokenLimit, // Daily token limit (50 calls per day)
  strictRateLimit,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const scenarioInputs = req.body;

    try {
      // Support both old format (type) and new format (category/scenario_description)
      const category = scenarioInputs.category || scenarioInputs.type || '';
      const scenarioText = scenarioInputs.scenario_description || scenarioInputs.scenario || scenarioInputs.text || '';
      
      if (!category && !scenarioText) {
        return res.status(400).json({
          success: false,
          message: 'Scenario description or category is required'
        });
      }

      const composite = await profileService.getProfile(userId);
      const profileData = composite?.userProfile?.profile_json || {};

      // Merge frontend-provided user_profile with database profile (frontend may have time_context, etc.)
      const frontendProfile = scenarioInputs.user_profile || {};
      const mergedProfile = {
        ...profileData,
        ...frontendProfile,
        // Ensure name, age, nationality, budget, vulnerabilities are included
        name: frontendProfile.name || profileData.name || '',
        age: frontendProfile.age || profileData.age || null,
        nationality: frontendProfile.nationality || profileData.nationality || null,
        budget: frontendProfile.budget || profileData.budget || null,
        vulnerabilities: frontendProfile.vulnerabilities || profileData.vulnerabilities || []
      };
      
      const qicTerms = scenarioInputs.qicTerms || null; // QIC terms JSON from frontend
      const timeContext = scenarioInputs.time_context || {}; // Time context (month, season, year)
      
      // Load insurance plans JSON (new structure)
      let insurancePlansJson = {};
      try {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const plansPath = path.join(__dirname, '../../src/data/insurancePlans.json');
        const plansData = fs.readFileSync(plansPath, 'utf8');
        insurancePlansJson = JSON.parse(plansData);
      } catch (e) {
        logger.warn('Could not load insurance plans JSON, using empty structure', e?.message);
      }
      
      // CRITICAL: Deduct coins BEFORE AI API call (10 coins for scenario analysis)
      const coinCost = 10;
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
      
      logger.info('Coins deducted for AI API call', {
        userId,
        coinCost,
        previousCoins: currentCoins,
        newCoins: currentCoins - coinCost,
        operation: 'scenario_analysis'
      });
      
      // Build contextual inputs with all personalization data
      const contextualInputs = {
        ...scenarioInputs,
        type: category,
        category: category,
        scenario: scenarioText,
        text: scenarioText,
        user_profile: mergedProfile,
        qicTerms,
        time_context: timeContext,
        insurance_plans_json: insurancePlansJson // Pass insurance plans JSON to AI prompt
      };
      
      let prediction;
      try {
        prediction = await aiService.predictScenarioOutcome(contextualInputs);
      } catch (aiError) {
        // If AI API fails (credits exceeded, etc.), return graceful error
        const errorMsg = aiError?.message || 'AI API unavailable';
        if (errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API')) {
          logger.warn('AI API unavailable, returning error to user', { error: errorMsg });
          return res.status(503).json({
            success: false,
            message: 'AI service temporarily unavailable. Please try again later or contact support if the issue persists.',
            error: errorMsg,
            disabled: true
          });
        }
        throw aiError; // Re-throw other errors
      }
      
      // CRITICAL: Ensure scenarios array ALWAYS exists in response
      if (!prediction.scenarios || !Array.isArray(prediction.scenarios) || prediction.scenarios.length === 0) {
        logger.warn('Prediction missing scenarios, ensuring fallback scenarios are included');
        prediction.scenarios = [
          `${scenarioInputs.scenario || scenarioInputs.scenario_description || 'Your scenario'} - LifeScore impact: -5`,
          'Unexpected events may occur without proper coverage - LifeScore impact: -8',
          'Protection gaps can impact your financial security - LifeScore impact: -6',
          'Being uninsured in this scenario risks significant losses - LifeScore impact: -7'
        ];
      }
      
      // CRITICAL: Extract best_plan from recommended_plans if AI didn't return it directly
      if (!prediction.best_plan && prediction.recommended_plans && Array.isArray(prediction.recommended_plans) && prediction.recommended_plans.length > 0) {
        // Sort by relevance_score (highest first), then by Maslow hierarchy if equal
        const sorted = [...prediction.recommended_plans].sort((a, b) => {
          const scoreA = a.relevance_score || 0;
          const scoreB = b.relevance_score || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          
          // Maslow hierarchy: Health (1) > Car/Home (2) > Travel/Family (3) > Life (4)
          const maslowOrder = {
            'Health Insurance': 1, 'Medical': 1, 'Health': 1,
            'Car Insurance': 2, 'Home': 2, 'Property': 2,
            'Travel Insurance': 3, 'Family': 3,
            'Life Insurance': 4
          };
          const orderA = maslowOrder[a.insurance_type || ''] || 5;
          const orderB = maslowOrder[b.insurance_type || ''] || 5;
          return orderA - orderB;
        });
        prediction.best_plan = sorted[0];
        logger.info('Extracted best_plan from recommended_plans', { plan_name: prediction.best_plan?.plan_name });
      }

      // Ensure recommendations are limited to MAX 5 and sorted by relevance
      if (prediction?.recommended_plans && Array.isArray(prediction.recommended_plans)) {
        prediction.recommended_plans = prediction.recommended_plans
          .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
          .slice(0, 5);
        
        // CRITICAL: Generate plan_scenarios for each recommended_plan if missing
        const userProfile = scenarioInputs.user_profile || {};
        const userName = userProfile.name || 'you';
        const userAge = userProfile.age || 30;
        const userNationality = userProfile.nationality || '';
        const scenarioText = scenarioInputs.scenario || scenarioInputs.scenario_description || '';
        
        prediction.recommended_plans = prediction.recommended_plans.map((plan) => {
          // If AI didn't provide plan_scenarios, generate 3 fallback ones
          if (!plan.plan_scenarios || !Array.isArray(plan.plan_scenarios) || plan.plan_scenarios.length < 3) {
            const baseScenarios = prediction.scenarios || [];
            const planScenarios = [];
            
            // Generate exactly 3 scenarios
            for (let i = 0; i < 3; i++) {
              const scenarioIndex = i < baseScenarios.length ? i : 0;
              const baseScenario = baseScenarios[scenarioIndex]?.replace(/LifeScore\s*impact[:\-]\s*-?\d+/i, '').trim() || scenarioText.substring(0, 40);
              const severity = 3 + (i * 2); // 3, 5, 7
              const lifescoreWithout = -Math.min(15, 5 + (i * 3)); // -5, -8, -11
              const lifescoreWith = Math.abs(lifescoreWithout) - 2; // +3, +6, +9
              
              planScenarios.push({
                scenario: `${userName} (age ${userAge}, ${userNationality}) might encounter: ${baseScenario}. Having ${plan.plan_name} coverage would protect you.`,
                feature: plan.insurance_type || 'Coverage',
                lifescore_with_coverage: lifescoreWith,
                lifescore_without_coverage: lifescoreWithout,
                severity: severity
              });
            }
            
            plan.plan_scenarios = planScenarios;
          }
          
          // Ensure exactly 3 scenarios
          if (plan.plan_scenarios.length > 3) {
            plan.plan_scenarios = plan.plan_scenarios.slice(0, 3);
          }
          
          return plan;
        });
      }
      
      // CRITICAL: Generate plan_scenarios for best_plan if missing
      if (prediction.best_plan && (!prediction.best_plan.plan_scenarios || !Array.isArray(prediction.best_plan.plan_scenarios) || prediction.best_plan.plan_scenarios.length < 3)) {
        const userProfile = scenarioInputs.user_profile || {};
        const userName = userProfile.name || 'you';
        const userAge = userProfile.age || 30;
        const userNationality = userProfile.nationality || '';
        const scenarioText = scenarioInputs.scenario || scenarioInputs.scenario_description || '';
        const baseScenarios = prediction.scenarios || [];
        
        const planScenarios = [];
        for (let i = 0; i < 3; i++) {
          const scenarioIndex = i < baseScenarios.length ? i : 0;
          const baseScenario = baseScenarios[scenarioIndex]?.replace(/LifeScore\s*impact[:\-]\s*-?\d+/i, '').trim() || scenarioText.substring(0, 40);
          const severity = 3 + (i * 2);
          const lifescoreWithout = -Math.min(15, 5 + (i * 3));
          const lifescoreWith = Math.abs(lifescoreWithout) - 2;
          
          planScenarios.push({
            scenario: `${userName} (age ${userAge}, ${userNationality}) might encounter: ${baseScenario}. Having ${prediction.best_plan.plan_name} coverage would protect you.`,
            feature: prediction.best_plan.insurance_type || 'Coverage',
            lifescore_with_coverage: lifescoreWith,
            lifescore_without_coverage: lifescoreWithout,
            severity: severity
          });
        }
        
        prediction.best_plan.plan_scenarios = planScenarios;
      }
      
      // Ensure best_plan has exactly 3 plan_scenarios
      if (prediction.best_plan?.plan_scenarios && prediction.best_plan.plan_scenarios.length > 3) {
        prediction.best_plan.plan_scenarios = prediction.best_plan.plan_scenarios.slice(0, 3);
      }

      // CRITICAL: Merge best_plan with real insurancePlans.json data to get standard_coverages
      if (prediction.best_plan && prediction.best_plan.plan_name) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          
          // Try multiple possible paths for insurancePlans.json
          let insurancePlansPath = path.join(__dirname, '../../src/data/insurancePlans.json');
          if (!fs.existsSync(insurancePlansPath)) {
            insurancePlansPath = path.join(__dirname, '../data/insurancePlans.json');
          }
          if (!fs.existsSync(insurancePlansPath)) {
            insurancePlansPath = path.join(process.cwd(), 'src', 'data', 'insurancePlans.json');
          }
          
          if (fs.existsSync(insurancePlansPath)) {
            const insurancePlansData = JSON.parse(fs.readFileSync(insurancePlansPath, 'utf8'));
            
            // Find matching plan in JSON
            for (const insuranceType of insurancePlansData) {
              const matchedPlan = insuranceType.plans?.find(p => 
                p.plan_name === prediction.best_plan.plan_name || 
                p.plan_name.toLowerCase() === prediction.best_plan.plan_name.toLowerCase()
              );
              if (matchedPlan) {
                // Merge real coverage data from JSON into best_plan
                prediction.best_plan.standard_coverages = matchedPlan.standard_coverages || prediction.best_plan.standard_coverages || [];
                prediction.best_plan.optional_add_ons = matchedPlan.optional_add_ons || prediction.best_plan.optional_add_ons || [];
                
                // Generate coverage_scenarios if missing and we have standard_coverages
                // CRITICAL: If AI didn't provide coverage_scenarios, generate them based on AI scenarios
                if (!prediction.best_plan.coverage_scenarios && prediction.best_plan.standard_coverages && Array.isArray(prediction.best_plan.standard_coverages)) {
                  const userProfile = scenarioInputs.user_profile || {};
                  const userName = userProfile.name || 'you';
                  const userAge = userProfile.age || 30;
                  const userNationality = userProfile.nationality || '';
                  const scenarioText = scenarioInputs.scenario || scenarioInputs.scenario_description || '';
                  
                  prediction.best_plan.coverage_scenarios = prediction.best_plan.standard_coverages.map((cov, idx) => {
                    const coverageItem = typeof cov === 'string' ? cov : (cov.item || 'Coverage');
                    const coverageDesc = typeof cov === 'string' ? '' : (cov.description || '');
                    
                    // Use AI-generated scenarios if available, otherwise create context-aware ones
                    const relevantScenarios = (prediction.scenarios || []).filter(s => 
                      s.toLowerCase().includes(coverageItem.toLowerCase().substring(0, 10))
                    );
                    const baseScenario = relevantScenarios.length > 0 
                      ? relevantScenarios[0].replace(/LifeScore\s*impact[:\-]\s*-?\d+/i, '').trim()
                      : scenarioText;
                    
                    return {
                      coverage_item: coverageItem,
                      scenario: `${userName} might need ${coverageItem} protection during ${baseScenario.substring(0, 40) || 'your scenario'}${coverageDesc ? `. ${coverageDesc}` : ''}`,
                      lifescore_impact: 5 + (idx * 2) // Escalating impact: 5, 7, 9, 11, etc.
                    };
                  });
                  
                  logger.info('Generated coverage_scenarios for best_plan', {
                    plan_name: prediction.best_plan.plan_name,
                    scenarios_count: prediction.best_plan.coverage_scenarios.length
                  });
                }
                
                // Ensure coverage_scenarios exists even if standard_coverages is empty
                if (!prediction.best_plan.coverage_scenarios) {
                  prediction.best_plan.coverage_scenarios = [];
                }
                
                logger.info('Merged best_plan with insurancePlans.json', { 
                  plan_name: prediction.best_plan.plan_name,
                  coverages_count: prediction.best_plan.standard_coverages?.length || 0
                });
                break;
              }
            }
          } else {
            logger.warn('insurancePlans.json not found at expected paths');
          }
        } catch (error) {
          logger.warn('Failed to merge best_plan with insurancePlans.json', { error: error.message });
        }
      }

      logger.info('Scenario simulation completed', {
        userId,
        scenarioType: scenarioInputs.type,
        scenariosCount: prediction.scenarios?.length || 0,
        hasBestPlan: !!prediction.best_plan,
        confidence: prediction.confidence
      });

      res.json({
        success: true,
        data: {
          ...prediction,
          scenarios: prediction.scenarios || [], // EXPLICITLY include scenarios
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

  // Plan Detail Generation Endpoint
  router.post('/plan-detail',
    authenticateUser,
    dailyTokenLimit, // Apply daily token limit
    strictRateLimit, // Apply strict rate limit
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { plan, user_profile, scenario_description } = req.body;

      if (!plan || !plan.plan_name) {
        return res.status(400).json({
          success: false,
          message: 'Plan data is required (plan_name must be provided)'
        });
      }

      // CRITICAL: Deduct coins BEFORE AI API call (5 coins for plan detail generation)
      const coinCost = 5;
      const { container } = await import('../di/container.js');
      const user = await container.repos.users.getById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const currentCoins = user.coins || 0;
      if (currentCoins < coinCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient coins. ${coinCost} coins required for AI plan detail generation. You have ${currentCoins}.`
        });
      }

      await container.repos.users.update(userId, {
        coins: Math.max(0, currentCoins - coinCost)
      });

      logger.info('Coins deducted for plan detail generation', {
        userId,
        coinCost,
        previousCoins: currentCoins,
        newCoins: currentCoins - coinCost,
        plan_name: plan.plan_name
      });

      try {
        const planDetailContent = await aiService.generatePlanDetailContent(plan, user_profile || {}, scenario_description || '');
        
        res.json({
          success: true,
          data: planDetailContent
        });
      } catch (aiError) {
        const errorMsg = aiError?.message || 'AI API unavailable';
        if (errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API')) {
          logger.warn('AI API unavailable for plan detail generation', { error: errorMsg });
          return res.status(503).json({
            success: false,
            message: 'AI service temporarily unavailable. Plan detail generation disabled. Please try again later.',
            error: errorMsg,
            disabled: true
          });
        }
        throw aiError;
      }
    })
  );

  return router;
}

export default createAiRouter;
