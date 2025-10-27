import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';

const router = express.Router();

// Get friends list (mock from profile or static)
router.get('/friends', authenticateUser, asyncHandler(async (req, res) => {
  const friends = [
    { id: 'friend-1', username: 'layla', level: 6, lifescore: 620, current_streak: 4, avatar_url: '' },
    { id: 'friend-2', username: 'omar', level: 8, lifescore: 740, current_streak: 9, avatar_url: '' },
  ];
  res.json({ success: true, data: { friends } });
}));

// Leaderboard (mocked from users)
router.get('/leaderboard', authenticateUser, asyncHandler(async (req, res) => {
  const you = await db.getUserById(req.user.id);
  const leaderboard = [
    { id: 'u-top1', username: 'amina', level: 12, lifescore: 900, xp: 1200 },
    { id: 'u-top2', username: 'yusuf', level: 11, lifescore: 870, xp: 1150 },
    { id: you?.id || 'mock-user-001', username: you?.username || 'you', level: you?.level || 4, lifescore: you?.lifescore || 450, xp: you?.xp || 350 },
  ];
  res.json({ success: true, data: { leaderboard } });
}));

// Collaborative missions (mocked)
router.get('/missions', authenticateUser, asyncHandler(async (req, res) => {
  const missions = [
    { id: 'collab-1', title: 'Family Fitness Week', description: 'Complete daily walks together', difficulty: 'easy', participants: ['friend-1'], progress: 35, xp_reward: 80 },
    { id: 'collab-2', title: 'Safe Driving Carpool', description: 'Accident-free week challenge', difficulty: 'medium', participants: [], progress: 10, xp_reward: 120 },
  ];
  res.json({ success: true, data: { missions } });
}));

// Invite friend (no-op)
router.post('/invite', authenticateUser, asyncHandler(async (req, res) => {
  const { friendId } = req.body;
  res.status(201).json({ success: true, message: 'Invitation sent', data: { friendId } });
}));

export default router;


