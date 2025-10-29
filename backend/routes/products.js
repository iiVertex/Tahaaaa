import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { container } from '../di/container.js';

const router = express.Router();

const productService = container.services.product;

router.get('/catalog', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const products = productService ? await productService.getEligibleProducts(userId) : [];
  res.json({ success: true, data: { products } });
}));

router.post('/bundle-savings', authenticateUser, asyncHandler(async (req, res) => {
  const { product_ids } = req.body || {};
  const result = productService ? productService.calculateBundleSavings(product_ids) : { subtotal: 0, savings_percent: 0, savings_amount: 0, total: 0 };
  res.json({ success: true, data: result });
}));

export default router;


