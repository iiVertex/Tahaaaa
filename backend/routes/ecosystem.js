import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { container } from '../di/container.js';

const router = express.Router();

// Track feature usage
router.post('/track', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { featureName, metadata } = req.body;
  const ecosystemService = container.services.ecosystem;
  
  if (!featureName) {
    return res.status(400).json({
      success: false,
      message: 'featureName is required'
    });
  }
  
  try {
    const result = await ecosystemService.trackFeatureUsage(userId, featureName, metadata || {});
    
    if (result.success) {
      logger.info('Feature usage tracked', { userId, featureName, metadata });
      res.json({ success: true, message: 'Feature usage tracked successfully' });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
    
  } catch (error) {
    logger.error('Feature usage tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track feature usage',
      error: error.message
    });
  }
}));

// Get ecosystem metrics for user
router.get('/metrics', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const ecosystemService = container.services.ecosystem;
  
  try {
    const metrics = await ecosystemService.getEcosystemMetrics(userId);
    
    logger.info('Ecosystem metrics retrieved', { userId, healthScore: metrics.ecosystemHealth.score });
    res.json({ success: true, data: metrics });
    
  } catch (error) {
    logger.error('Ecosystem metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ecosystem metrics',
      error: error.message
    });
  }
}));

// Get ecosystem analytics (admin only)
router.get('/analytics', authenticateUser, asyncHandler(async (req, res) => {
  const ecosystemService = container.services.ecosystem;
  
  try {
    const analytics = await ecosystemService.getEcosystemAnalytics();
    
    logger.info('Ecosystem analytics retrieved', { analytics });
    res.json({ success: true, data: analytics });
    
  } catch (error) {
    logger.error('Ecosystem analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ecosystem analytics',
      error: error.message
    });
  }
}));

export default router;
