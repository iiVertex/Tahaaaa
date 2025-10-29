import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { container } from '../di/container.js';
import { strictRateLimit } from '../middleware/security.js';

const router = express.Router();

// Record a product purchase
router.post('/purchase', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const purchaseData = req.body;
  const multiproductService = container.services.multiproduct;
  
  // Validate required fields
  const requiredFields = ['product_id', 'product_type', 'product_name', 'purchase_amount'];
  const missingFields = requiredFields.filter(field => !purchaseData[field]);
  
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`
    });
  }
  
  try {
    const result = await multiproductService.recordPurchase(userId, purchaseData);
    
    if (result.success) {
      logger.info('Purchase recorded', { userId, productId: purchaseData.product_id });
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
    
  } catch (error) {
    logger.error('Purchase recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record purchase',
      error: error.message
    });
  }
}));

// Get user's purchase history
router.get('/purchases', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const multiproductService = container.services.multiproduct;
  
  try {
    const result = await multiproductService.getUserPurchases(userId);
    
    logger.info('User purchases retrieved', { userId, purchaseCount: result.purchases.length });
    res.json({ success: true, data: result });
    
  } catch (error) {
    logger.error('Get user purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get purchase history',
      error: error.message
    });
  }
}));

// Get cross-sell recommendations
router.get('/recommendations', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const multiproductService = container.services.multiproduct;
  
  try {
    const recommendations = await multiproductService.getCrossSellRecommendations(userId);
    
    logger.info('Cross-sell recommendations generated', { userId, recommendationCount: recommendations.recommendations.length });
    res.json({ success: true, data: recommendations });
    
  } catch (error) {
    logger.error('Cross-sell recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cross-sell recommendations',
      error: error.message
    });
  }
}));

// Get multi-product analytics (admin only)
router.get('/analytics', authenticateUser, asyncHandler(async (req, res) => {
  const multiproductService = container.services.multiproduct;
  
  try {
    const analytics = await multiproductService.getMultiProductAnalytics();
    
    logger.info('Multi-product analytics retrieved', { analytics });
    res.json({ success: true, data: analytics });
    
  } catch (error) {
    logger.error('Multi-product analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get multi-product analytics',
      error: error.message
    });
  }
}));

export default router;
