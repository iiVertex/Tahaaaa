import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { strictRateLimit } from '../middleware/security.js';

/** @param {{ scenario: import('../services/scenario.service.js').ScenarioService, mission?: import('../services/mission.service.js').MissionService }} deps */
export function createScenariosRouter(deps) {
  const router = express.Router();
  const scenarioService = deps?.scenario;
  const missionService = deps?.mission;

  router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const scenarios = scenarioService.listScenarios();
    res.json({ success: true, data: { scenarios } });
  }));

  // Simulate scenario (for redundancy with /api/ai/scenarios/simulate used by frontend)
  router.post('/simulate', authenticateUser, strictRateLimit, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const inputs = req.body || {};
    const apply = String(req.query.apply || 'false') === 'true';

    const prediction = await scenarioService.simulate(userId, inputs);

    let applied = null;
    if (apply && Array.isArray(prediction?.suggested_missions) && prediction.suggested_missions.length > 0) {
      try {
        const toStart = prediction.suggested_missions.slice(0, 1);
        for (const m of toStart) {
          await missionService.startMission(userId, m.id);
        }
        applied = { started: toStart.map(m => m.id) };
      } catch (e) {
        applied = { error: 'Failed to apply missions' };
      }
    }

    res.json({ success: true, data: { ...prediction, applied } });
  }));

  return router;
}

export default createScenariosRouter;


