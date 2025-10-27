import express from 'express';
import { validate, updateProfileSchema } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';
import { gamificationService } from '../services/gamification.service.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get user profile
router.get('/', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      // Get user data
      const user = await db.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user profile
      const userProfile = await db.getUserProfile(userId);
      
      // Get gamification stats
      const stats = await gamificationService.getUserStats(userId);
      
      // Get achievement suggestions
      const suggestions = await gamificationService.getAchievementSuggestions(userId);

      // Decrypt sensitive data if available
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
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
        error: error.message
      });
    }
  })
);

// Update user profile
router.put('/', 
  authenticateUser,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const updates = req.body;

    try {
      // Update user data
      const userUpdates = {};
      if (updates.username) userUpdates.username = updates.username;
      if (updates.avatar_url) userUpdates.avatar_url = updates.avatar_url;

      if (Object.keys(userUpdates).length > 0) {
        await db.updateUser(userId, userUpdates);
      }

      // Update profile data
      if (updates.preferences || updates.settings) {
        const currentProfile = await db.getUserProfile(userId);
        const updatedProfile = {
          ...currentProfile?.profile_json,
          ...updates.preferences && { preferences: updates.preferences },
          ...updates.settings && { settings: updates.settings },
          updated_at: new Date().toISOString()
        };

        await db.updateUserProfile(userId, updatedProfile);
      }

      logger.info('User profile updated', {
        userId,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updates
      });

    } catch (error) {
      logger.error('Error updating user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
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

      res.json({
        success: true,
        data: {
          ...stats,
          suggestions
        }
      });

    } catch (error) {
      logger.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user stats',
        error: error.message
      });
    }
  })
);

// Update user preferences
router.put('/preferences', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { preferences } = req.body;

    try {
      const currentProfile = await db.getUserProfile(userId);
      const updatedProfile = {
        ...currentProfile?.profile_json,
        preferences: {
          ...currentProfile?.profile_json?.preferences,
          ...preferences
        },
        updated_at: new Date().toISOString()
      };

      await db.updateUserProfile(userId, updatedProfile);

      logger.info('User preferences updated', {
        userId,
        preferences
      });

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
      });

    } catch (error) {
      logger.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update preferences',
        error: error.message
      });
    }
  })
);

// Update user settings
router.put('/settings', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { settings } = req.body;

    try {
      // Update user table for language and theme
      const userUpdates = {};
      if (settings.language) userUpdates.language = settings.language;
      if (settings.theme) userUpdates.theme = settings.theme;

      if (Object.keys(userUpdates).length > 0) {
        await db.updateUser(userId, userUpdates);
      }

      // Update profile for other settings
      const currentProfile = await db.getUserProfile(userId);
      const updatedProfile = {
        ...currentProfile?.profile_json,
        settings: {
          ...currentProfile?.profile_json?.settings,
          ...settings
        },
        updated_at: new Date().toISOString()
      };

      await db.updateUserProfile(userId, updatedProfile);

      logger.info('User settings updated', {
        userId,
        settings
      });

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: settings
      });

    } catch (error) {
      logger.error('Error updating settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings',
        error: error.message
      });
    }
  })
);

// Get user integrations
router.get('/integrations', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
      const userProfile = await db.getUserProfile(userId);
      const integrations = userProfile?.profile_json?.integrations || [];

      res.json({
        success: true,
        data: {
          integrations,
          available_integrations: [
            'QIC Mobile App',
            'QIC Health Portal',
            'QIC Claims Portal',
            'QIC Rewards Program',
            'QIC Family Dashboard',
            'QIC Financial Planner'
          ]
        }
      });

    } catch (error) {
      logger.error('Error getting user integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get integrations',
        error: error.message
      });
    }
  })
);

// Update user integrations (admin only or during onboarding)
router.put('/integrations', 
  authenticateUser,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { integrations } = req.body;

    try {
      // Validate integrations
      if (!Array.isArray(integrations) || integrations.length !== 3) {
        return res.status(400).json({
          success: false,
          message: 'Exactly 3 integrations must be selected'
        });
      }

      const validIntegrations = [
        'QIC Mobile App',
        'QIC Health Portal',
        'QIC Claims Portal',
        'QIC Rewards Program',
        'QIC Family Dashboard',
        'QIC Financial Planner'
      ];

      const invalidIntegrations = integrations.filter(integration => 
        !validIntegrations.includes(integration)
      );

      if (invalidIntegrations.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid integrations selected',
          invalid: invalidIntegrations
        });
      }

      // Update profile
      const currentProfile = await db.getUserProfile(userId);
      const updatedProfile = {
        ...currentProfile?.profile_json,
        integrations,
        updated_at: new Date().toISOString()
      };

      await db.updateUserProfile(userId, updatedProfile);

      logger.info('User integrations updated', {
        userId,
        integrations
      });

      res.json({
        success: true,
        message: 'Integrations updated successfully',
        data: { integrations }
      });

    } catch (error) {
      logger.error('Error updating integrations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update integrations',
        error: error.message
      });
    }
  })
);

export default router;
