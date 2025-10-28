import express from 'express';
import { validate, updateProfileSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { strictRateLimit } from '../middleware/security.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

/** @param {{ profile: import('../services/profile.service.js').ProfileService, gamification: import('../services/gamification.service.js').GamificationService }} deps */
export function createProfileRouter(deps) {
  const router = express.Router();
  const profileService = deps?.profile;
  const gamificationService = deps?.gamification;

  // Get user profile
  router.get('/', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const composite = await profileService.getProfile(userId);
        if (!composite?.user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }
        const { user, userProfile, stats, suggestions } = composite;

        let decryptedData = null;
        if (userProfile?.encrypted_data) {
          try {
            decryptedData = await decrypt(userProfile.encrypted_data);
          } catch (error) {
            logger.warn('Failed to decrypt user data:', error);
          }
        }

        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              avatar_url: user.avatar_url,
              language: user.language,
              theme: user.theme,
              created_at: user.created_at,
              updated_at: user.updated_at
            },
            profile: userProfile?.profile_json || {},
            stats,
            suggestions,
            decrypted_data: decryptedData ? JSON.parse(decryptedData) : null
          }
        });

      } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to get user profile', error: error.message });
      }
    })
  );

  // Update user profile (username/avatar/preferences/settings)
  router.put('/', 
    authenticateUser,
    strictRateLimit,
    validate(updateProfileSchema),
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const updates = req.body;

      try {
        const updated = await profileService.updateProfile(userId, updates);
        logger.info('User profile updated', { userId, updates: Object.keys(updates) });
        res.json({ success: true, message: 'Profile updated successfully', data: updated });
      } catch (error) {
        logger.error('Error updating user profile:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
      }
    })
  );

  // Get user gamification stats
  router.get('/stats', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;

      try {
        const stats = await gamificationService.getUserStats(userId);
        const suggestions = await gamificationService.getAchievementSuggestions(userId);
        res.json({ success: true, data: { ...stats, suggestions } });
      } catch (error) {
        logger.error('Error getting user stats:', error);
        res.status(500).json({ success: false, message: 'Failed to get user stats', error: error.message });
      }
    })
  );

  // Update user preferences only
  router.put('/preferences', 
    authenticateUser,
    strictRateLimit,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { preferences } = req.body || {};
      try {
        const updated = await profileService.updateProfile(userId, { preferences });
        res.json({ success: true, message: 'Preferences updated successfully', data: updated });
      } catch (error) {
        logger.error('Error updating preferences:', error);
        res.status(500).json({ success: false, message: 'Failed to update preferences', error: error.message });
      }
    })
  );

  // Update user settings only
  router.put('/settings', 
    authenticateUser,
    strictRateLimit,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { settings } = req.body || {};
      try {
        const updated = await profileService.updateProfile(userId, { settings });
        res.json({ success: true, message: 'Settings updated successfully', data: updated });
      } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
      }
    })
  );

  // Get integrations
  router.get('/integrations', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      try {
        const userProfile = (await profileService.getProfile(userId))?.userProfile;
        const integrations = userProfile?.profile_json?.integrations || [];
        res.json({ success: true, data: { integrations, available_integrations: [
          'QIC Mobile App', 'QIC Health Portal', 'QIC Claims Portal', 'QIC Rewards Program', 'QIC Family Dashboard', 'QIC Financial Planner'
        ] } });
      } catch (error) {
        logger.error('Error getting integrations:', error);
        res.status(500).json({ success: false, message: 'Failed to get integrations', error: error.message });
      }
    })
  );

  // Update integrations
  router.put('/integrations', 
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { integrations } = req.body || {};
      try {
        if (!Array.isArray(integrations) || integrations.length !== 3) {
          return res.status(400).json({ success: false, message: 'Exactly 3 integrations must be selected' });
        }
        const validIntegrations = [
          'QIC Mobile App', 'QIC Health Portal', 'QIC Claims Portal', 'QIC Rewards Program', 'QIC Family Dashboard', 'QIC Financial Planner'
        ];
        const invalid = integrations.filter(x => !validIntegrations.includes(x));
        if (invalid.length) {
          return res.status(400).json({ success: false, message: 'Invalid integrations selected', invalid });
        }
        const updated = await profileService.updateProfile(userId, { integrations });
        res.json({ success: true, message: 'Integrations updated successfully', data: { integrations: updated?.userProfile?.profile_json?.integrations || integrations } });
      } catch (error) {
        logger.error('Error updating integrations:', error);
        res.status(500).json({ success: false, message: 'Failed to update integrations', error: error.message });
      }
    })
  );

  return router;
}

export default createProfileRouter;
