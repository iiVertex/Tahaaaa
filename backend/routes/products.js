import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { container } from '../di/container.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const productService = container.services.product;

router.get('/catalog', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const products = productService ? await productService.getEligibleProducts(userId) : [];
  res.json({ success: true, data: { products } });
}));

router.post('/bundle-savings', authenticateUser, asyncHandler(async (req, res) => {
  const { product_ids } = req.body || {};
  const userId = req.user?.id;
  
  // Fetch user coins from database if userId is available
  let userCoins = null;
  if (userId && container.repos?.users) {
    try {
      const user = await container.repos.users.getById(userId);
      userCoins = user?.coins || 0;
    } catch (error) {
      logger.warn('Failed to fetch user coins for bundle calculation', { userId, error: error.message });
      // Continue without coins discount if fetch fails
    }
  }
  
  const result = productService ? productService.calculateBundleSavings(product_ids, userCoins) : { 
    subtotal: 0, 
    savings_percent: 0, 
    savings_amount: 0, 
    total: 0,
    bundle_discount_percentage: 0,
    coins_discount_percentage: 0,
    bundle_savings_amount: 0,
    coins_savings_amount: 0
  };
  res.json({ success: true, data: result });
}));

export default router;


