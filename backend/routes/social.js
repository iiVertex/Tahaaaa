import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { leaderboardService } from '../services/leaderboard.service.js';

const router = express.Router();

// Get friends list (mock from profile or static)
router.get('/friends', authenticateUser, asyncHandler(async (req, res) => {
  const friends = await leaderboardService.friendsList(req.user.id);
  res.json({ success: true, data: { friends } });
}));

// Leaderboard (mocked from users)
router.get('/leaderboard', authenticateUser, asyncHandler(async (req, res) => {
  const leaderboard = await leaderboardService.topByLifeScore(10);
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

// Factory (DI-friendly) export for future use
/** @param {{ leaderboardService: import('../services/leaderboard.service.js').LeaderboardService }} deps */
export function createSocialRouter(deps) {
  return router;
}


