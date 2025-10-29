import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { container } from '../di/container.js';

const router = express.Router();

// Dynamic prequalified offers using profile + product eligibility
router.get('/prequalified', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profileService = container.services.profile;
  const productService = container.services.product;

  const composite = await profileService.getProfile(userId);
  const stats = composite?.stats || {};
  const lifescore = stats?.lifescore || 50;
  const products = await productService.getEligibleProducts(userId);
  const eligibles = products.filter((p) => p.eligible);

  const offers = eligibles.slice(0, 3).map((p) => ({
    product_id: p.id,
    name: p.name,
    type: p.type,
    discount: lifescore >= 70 ? 0.15 : lifescore >= 50 ? 0.1 : 0.05,
    cta: 'Get Quote'
  }));

  res.json({ success: true, data: { offers } });
}));

export default router;


