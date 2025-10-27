import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { db } from '../services/supabase.js';

const router = express.Router();

const mockTrees = {
  safe_driving: {
    id: 'safe_driving',
    levels: [
      { id: 'sd-l1', level: 1, description: 'Basics', skills: [
        { id: 'sd-s1', title: 'Seatbelt Habit', category: 'safe_driving', xp_cost: 20, xp_reward: 30, lifescore_impact: 10, requirements: [], isUnlocked: true, isCompleted: false },
        { id: 'sd-s2', title: 'Speed Awareness', category: 'safe_driving', xp_cost: 30, xp_reward: 40, lifescore_impact: 12, requirements: [], isUnlocked: false, isCompleted: false },
      ]}
    ],
    skills: []
  },
  health: {
    id: 'health',
    levels: [
      { id: 'h-l1', level: 1, description: 'Foundation', skills: [
        { id: 'h-s1', title: 'Daily Hydration', category: 'health', xp_cost: 10, xp_reward: 20, lifescore_impact: 8, requirements: [], isUnlocked: true, isCompleted: false },
      ]}
    ],
    skills: []
  },
  financial_guardian: {
    id: 'financial_guardian',
    levels: [
      { id: 'f-l1', level: 1, description: 'Awareness', skills: [
        { id: 'f-s1', title: 'Emergency Fund', category: 'financial_guardian', xp_cost: 40, xp_reward: 60, lifescore_impact: 20, requirements: [], isUnlocked: false, isCompleted: false },
      ]}
    ],
    skills: []
  }
};

router.get('/', authenticateUser, asyncHandler(async (req, res) => {
  const { category = 'safe_driving' } = req.query;
  const tree = mockTrees[category] || mockTrees.safe_driving;
  // Flatten skills for sidebar recommendations
  tree.skills = tree.levels.flatMap(l => l.skills);
  res.json({ success: true, data: tree });
}));

router.get('/user', authenticateUser, asyncHandler(async (req, res) => {
  const skills = await db.getUserSkills(req.user.id);
  res.json({ success: true, data: { skills } });
}));

router.post('/unlock', authenticateUser, asyncHandler(async (req, res) => {
  const { skillId } = req.body;
  const sessionId = req.sessionId;
  
  await db.unlockUserSkill(sessionId, skillId, { unlocked_at: new Date().toISOString() });
  
  // Award XP and LifeScore bonus
  const currentStats = await db.getStats(sessionId);
  const updatedStats = await db.upsertStats(sessionId, {
    xp: currentStats.xp + 30,
    lifescore: currentStats.lifescore + 8
  });
  
  res.status(201).json({ 
    success: true, 
    message: 'Skill unlocked', 
    data: { 
      skill: { id: skillId, unlocked: true },
      updated_user: updatedStats
    } 
  });
}));

export default router;


