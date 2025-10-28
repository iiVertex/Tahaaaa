import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** @param {{ ai: import('../services/ai.service.js').AIService, profile: import('../services/profile.service.js').ProfileService, gamification: import('../services/gamification.service.js').GamificationService }} deps */
export function createPersonalizationRouter(deps) {
  const router = express.Router();
  const aiService = deps.ai;
  const profileService = deps.profile;
  const gamification = deps.gamification;

  // Returns layout modules with priority and visibility based on profile & stats
  router.get('/layout', authenticateUser, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const composite = await profileService.getProfile(userId);
    const profileData = composite?.userProfile?.profile_json || {};
    const stats = composite?.stats || {};

    // Base priorities
    const modules = [
      { key: 'missions', priority: 70, visible: true },
      { key: 'rewards', priority: 50, visible: true },
      { key: 'scenarios', priority: 40, visible: true },
      { key: 'ai_insights', priority: 60, visible: true },
      { key: 'social', priority: 30, visible: true },
    ];

    // Adjust by LifeScore
    if ((stats.lifescore ?? 0) < 50) {
      bump(modules, 'missions', 20);
      bump(modules, 'ai_insights', 15);
    } else {
      bump(modules, 'rewards', 10);
    }

    // Adjust by coins
    if ((stats.coins ?? 0) >= 200) {
      bump(modules, 'rewards', 20);
    }

    // Adjust by integrations
    const integrations = profileData.integrations || [];
    if (!Array.isArray(integrations) || integrations.length === 0) {
      bump(modules, 'ai_insights', 10);
    }

    // Sort by priority desc
    modules.sort((a, b) => b.priority - a.priority);

    // Include AI insights and suggestions in a single payload for convenience
    const [insights, suggestedMissions] = await Promise.all([
      aiService.predictInsights(userId),
      aiService.recommendAdaptiveMissions(userId, profileData)
    ]);

    res.json({
      success: true,
      data: {
        modules,
        insights,
        suggested_missions: suggestedMissions,
        generated_at: new Date().toISOString()
      }
    });
  }));

  return router;

  function bump(mods, key, inc) {
    const m = mods.find(x => x.key === key);
    if (m) m.priority += inc;
  }
}

export default createPersonalizationRouter;


