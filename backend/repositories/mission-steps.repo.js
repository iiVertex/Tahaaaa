import { db } from '../services/supabase.js';

export class MissionStepsRepo {
  constructor(database = db) {
    this.db = database;
  }

  async createSteps(userMissionId, steps) {
    // steps: [{ step_number, title, description }]
    return this.db.createMissionSteps(userMissionId, steps);
  }

  async getByUserMission(userMissionId) {
    return this.db.getMissionSteps(userMissionId);
  }

  async completeStep(stepId) {
    return this.db.completeMissionStep(stepId);
  }

  async areAllStepsCompleted(userMissionId) {
    const steps = await this.getByUserMission(userMissionId);
    return steps.length === 3 && steps.every(s => s.status === 'completed');
  }
}

export default MissionStepsRepo;

