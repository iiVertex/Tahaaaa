import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { aiService } from '../services/ai.service.js';
import { db } from '../services/supabase.js';

const router = express.Router();

// List available scenarios (mock)
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
  const scenarios = [
    {
      id: 'scenario-1',
      title: 'Daily Commute Safety',
      description: 'Estimate risk and impact of commute changes',
      category: 'safe_driving',
      difficulty: 'easy',
      inputs: [
        { name: 'commute_distance', label: 'Commute Distance (km)', type: 'number', placeholder: '15' },
        { name: 'driving_hours', label: 'Daily Driving Hours', type: 'number', placeholder: '1.5' },
        { name: 'seatbelt_usage', label: 'Seatbelt Usage', type: 'select', options: [
          { value: 'always', label: 'Always' },
          { value: 'often', label: 'Often' },
          { value: 'rarely', label: 'Rarely' }
        ] }
      ]
    },
    {
      id: 'scenario-2',
      title: 'Health Routine Change',
      description: 'What if you add daily walking?',
      category: 'health',
      difficulty: 'medium',
      inputs: [
        { name: 'walk_minutes', label: 'Walk Minutes/Day', type: 'number', placeholder: '30' },
        { name: 'diet_quality', label: 'Diet Quality', type: 'select', options: [
          { value: 'excellent', label: 'Excellent' },
          { value: 'good', label: 'Good' },
          { value: 'fair', label: 'Fair' },
          { value: 'poor', label: 'Poor' }
        ] }
      ]
    }
  ];
  res.json({ success: true, data: { scenarios } });
}));

export default router;

// Simulate scenario (for redundancy with /api/ai/scenarios/simulate used by frontend)
router.post('/simulate', authenticateUser, asyncHandler(async (req, res) => {
  const sessionId = req.sessionId;
  const inputs = req.body || {};
  
  const prediction = {
    predicted_outcome: 'Completing this scenario improves your health metrics over 2 weeks.',
    risk_level: 'medium',
    lifescore_impact: 12,
    xp_reward: 40
  };
  
  // Award XP and LifeScore
  const currentStats = await db.getStats(sessionId);
  const updatedStats = await db.upsertStats(sessionId, {
    xp: currentStats.xp + prediction.xp_reward,
    lifescore: currentStats.lifescore + prediction.lifescore_impact
  });
  
  res.json({ 
    success: true, 
    data: { 
      ...prediction,
      updated_user: updatedStats
    } 
  });
}));


