import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';

const router = express.Router();

// All achievements (from DB)
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
  try {
    if (typeof db?.query === 'function') {
      const rows = await db.query('achievements', { type: 'select' }, { filters: { is_active: true } });
      return res.json({ success: true, data: { achievements: rows || [] } });
    }
  } catch (_) {}
  res.json({ success: true, data: { achievements: [] } });
}));

// User's earned achievements
router.get('/user', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  try {
    if (typeof db?.query === 'function') {
      const rows = await db.query('user_achievements', { type: 'select' }, { filters: { user_id: userId } });
      return res.json({ success: true, data: { user_achievements: rows || [] } });
    }
  } catch (_) {}
  res.json({ success: true, data: { user_achievements: [] } });
}));

export default router;


