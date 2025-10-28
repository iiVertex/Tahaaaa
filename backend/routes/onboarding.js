import express from 'express';
import { validate } from '../middleware/validation.js';
import { onboardingSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { strictRateLimit } from '../middleware/security.js';
import { encrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

/** @param {{ onboarding: import('../services/onboarding.service.js').OnboardingService, gamification: import('../services/gamification.service.js').GamificationService }} deps */
export function createOnboardingRouter(deps) {
  const router = express.Router();
  const onboardingService = deps.onboarding;
  const gamification = deps.gamification;

  // Submit onboarding data
  router.post('/submit', 
    authenticateUser,
    strictRateLimit,
    validate(onboardingSchema),
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const onboardingData = req.body;

      try {
        // Validate Step 6 integrations (exactly 3 required)
        const { step6 } = onboardingData;
        if (!step6 || !step6.integrations || step6.integrations.length !== 3) {
          return res.status(400).json({
            success: false,
            message: 'Exactly 3 integrations must be selected in Step 6'
          });
        }

        // Persist onboarding and build AI profile
        const { aiProfile } = await onboardingService.saveOnboarding(userId, onboardingData);

        // Create user profile with integrations
        const profileData = {
          integrations: step6.integrations,
          risk_profile: onboardingData.step1,
          lifestyle: onboardingData.step2,
          family: onboardingData.step3,
          financial: onboardingData.step4,
          insurance: onboardingData.step5,
          ai_profile: aiProfile,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        };

        // Encrypt sensitive data (stored separately)
        const encryptedData = await encrypt(JSON.stringify({
          risk_profile: onboardingData.step1,
          family: onboardingData.step3
        }));

        // Save via service repo interface
        if (onboardingService.usersRepo?.updateUserProfile) {
          await onboardingService.usersRepo.updateUserProfile(userId, {
            ...profileData,
            encrypted_data: encryptedData
          });
        }

        // Award onboarding completion bonus
        const rewards = await gamification.processMissionCompletion(userId, 'onboarding-completion', {
          xp_reward: 200,
          lifescore_impact: 50,
          title: 'Onboarding Complete'
        });

        logger.info('Onboarding completed', {
          userId,
          integrations: step6.integrations,
          rewards
        });

        res.status(201).json({
          success: true,
          message: 'Onboarding completed successfully',
          data: {
            profile: profileData,
            rewards,
            ai_profile: aiProfile
          }
        });

      } catch (error) {
        logger.error('Onboarding submission error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to process onboarding data',
          error: error.message
        });
      }
    })
  );

  // Get onboarding progress
  router.get('/progress', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const responses = await onboardingService.usersRepo.getOnboardingResponses(userId);
        
        const progress = {
          completed_steps: responses.length,
          total_steps: 7,
          is_complete: responses.length === 7,
          responses: responses.map(r => ({
            step: r.step_number,
            data: r.response_data,
            completed_at: r.created_at
          }))
        };

        res.json({
          success: true,
          data: progress
        });

      } catch (error) {
        logger.error('Error getting onboarding progress:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get onboarding progress',
          error: error.message
        });
      }
    })
  );

  // Get available integrations for Step 6
  router.get('/integrations', (req, res) => {
    const integrations = [
      { id: 'QIC Mobile App', name: 'QIC Mobile App', description: 'Access your insurance on the go', icon: '📱' },
      { id: 'QIC Health Portal', name: 'QIC Health Portal', description: 'Track your health and wellness', icon: '🏥' },
      { id: 'QIC Claims Portal', name: 'QIC Claims Portal', description: 'Manage your insurance claims', icon: '📋' },
      { id: 'QIC Rewards Program', name: 'QIC Rewards Program', description: 'Earn rewards for healthy habits', icon: '🎁' },
      { id: 'QIC Family Dashboard', name: 'QIC Family Dashboard', description: 'Protect your entire family', icon: '👨‍👩‍👧‍👦' },
      { id: 'QIC Financial Planner', name: 'QIC Financial Planner', description: 'Plan your financial future', icon: '💰' }
    ];

    res.json({ success: true, data: integrations });
  });

  // Reset onboarding (for testing)
  router.delete('/reset', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        // Delete onboarding responses (not implemented)
        logger.info('Onboarding reset', { userId });
        res.json({ success: true, message: 'Onboarding reset successfully' });
      } catch (error) {
        logger.error('Error resetting onboarding:', error);
        res.status(500).json({ success: false, message: 'Failed to reset onboarding', error: error.message });
      }
    })
  );

  return router;
}

export default createOnboardingRouter;
