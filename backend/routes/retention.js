import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { container } from '../di/container.js';

const router = express.Router();

// Get user retention metrics
router.get('/metrics', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const retentionService = container.services.retention;
  
  try {
    const metrics = await retentionService.calculateRetentionMetrics(userId);
    
    logger.info('Retention metrics retrieved', { userId, metrics });
    res.json({ success: true, data: metrics });
    
  } catch (error) {
    logger.error('Retention metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get retention metrics',
      error: error.message
    });
  }
}));

// Get cohort analysis (admin only)
router.get('/cohorts', authenticateUser, asyncHandler(async (req, res) => {
  const retentionService = container.services.retention;
  
  try {
    const analysis = await retentionService.getCohortAnalysis();
    
    logger.info('Cohort analysis retrieved', { analysis });
    res.json({ success: true, data: analysis });
    
  } catch (error) {
    logger.error('Cohort analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cohort analysis',
      error: error.message
    });
  }
}));

// Track user activity
router.post('/activity', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { activityType, metadata } = req.body;
  const retentionService = container.services.retention;
  
  if (!activityType) {
    return res.status(400).json({
      success: false,
      message: 'activityType is required'
    });
  }
  
  try {
    await retentionService.trackActivity(userId, activityType, metadata || {});
    
    logger.info('Activity tracked', { userId, activityType, metadata });
    res.json({ success: true, message: 'Activity tracked successfully' });
    
  } catch (error) {
    logger.error('Activity tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track activity',
      error: error.message
    });
  }
}));

export default router;
