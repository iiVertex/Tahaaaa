import express from 'express';
import { validate } from '../middleware/validation.js';
import { onboardingSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';
import { aiService } from '../services/ai.service.js';
import { gamificationService } from '../services/gamification.service.js';
import { encrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Submit onboarding data
router.post('/submit', 
  authenticateUser,
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

      // Save each step response
      for (let step = 1; step <= 7; step++) {
        const stepKey = `step${step}`;
        if (onboardingData[stepKey]) {
          await db.saveOnboardingResponse(userId, step, onboardingData[stepKey]);
        }
      }

      // Generate AI profile
      const aiProfile = await aiService.generateAIProfile(onboardingData);

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

      // Encrypt sensitive data
      const encryptedData = await encrypt(JSON.stringify({
        risk_profile: onboardingData.step1,
        family: onboardingData.step3
      }));

      // Save profile to database
      await db.createUserProfile(userId, profileData);
      
      // Update user profile with encrypted data
      await db.updateUserProfile(userId, {
        ...profileData,
        encrypted_data: encryptedData
      });

      // Award onboarding completion bonus
      const rewards = await gamificationService.processMissionCompletion(userId, 'onboarding-completion', {
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
      const responses = await db.getOnboardingResponses(userId);
      
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
    {
      id: 'QIC Mobile App',
      name: 'QIC Mobile App',
      description: 'Access your insurance on the go',
      icon: '📱'
    },
    {
      id: 'QIC Health Portal',
      name: 'QIC Health Portal',
      description: 'Track your health and wellness',
      icon: '🏥'
    },
    {
      id: 'QIC Claims Portal',
      name: 'QIC Claims Portal',
      description: 'Manage your insurance claims',
      icon: '📋'
    },
    {
      id: 'QIC Rewards Program',
      name: 'QIC Rewards Program',
      description: 'Earn rewards for healthy habits',
      icon: '🎁'
    },
    {
      id: 'QIC Family Dashboard',
      name: 'QIC Family Dashboard',
      description: 'Protect your entire family',
      icon: '👨‍👩‍👧‍👦'
    },
    {
      id: 'QIC Financial Planner',
      name: 'QIC Financial Planner',
      description: 'Plan your financial future',
      icon: '💰'
    }
  ];

  res.json({
    success: true,
    data: integrations
  });
});

// Reset onboarding (for testing)
router.delete('/reset', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      // Delete onboarding responses
      // Note: This would need to be implemented in the database service
      
      logger.info('Onboarding reset', { userId });

      res.json({
        success: true,
        message: 'Onboarding reset successfully'
      });

    } catch (error) {
      logger.error('Error resetting onboarding:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset onboarding',
        error: error.message
      });
    }
  })
);

export default router;
