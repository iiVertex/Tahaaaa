import { logger } from '../utils/logger.js';

export class MissionService {
  // deps.repos: { missions, userMissions, users, analytics }
  constructor(deps = {}, gamification) {
    this.missionsRepo = deps.missions;
    this.userMissionsRepo = deps.userMissions;
    this.usersRepo = deps.users;
    this.analyticsRepo = deps.analytics;
    this.gamification = gamification;
  }

  async listMissions(filters = {}, userId) {
    const missions = await this.missionsRepo.list(filters);
    if (!userId) return { missions, userProgress: [] };
    const userMissions = await this.userMissionsRepo.byUser(userId);
    return { missions, userProgress: userMissions };
  }

  async startMission(userId, missionId) {
    const mission = await this.missionsRepo.getById(missionId);
    if (!mission) {
      return { ok: false, status: 404, message: 'Mission not found' };
    }
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    const exists = active.find(m => m.mission_id === missionId);
    if (exists) {
      return { ok: false, status: 409, message: 'Mission already started' };
    }
    await this.userMissionsRepo.start(userId, missionId);
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_started', event_data: { mission_id: missionId }, created_at: new Date().toISOString() });
    logger.info('Mission started', { userId, missionId });
    return { ok: true };
  }

  async completeMission(userId, missionId, completionData = {}) {
    const mission = await this.missionsRepo.getById(missionId);
    if (!mission) {
      return { ok: false, status: 404, message: 'Mission not found' };
    }
    const active = await this.userMissionsRepo.byUser(userId, 'active');
    const userMission = active.find(m => m.mission_id === missionId);
    if (!userMission) {
      return { ok: false, status: 400, message: 'Mission not started or already completed' };
    }
    await this.userMissionsRepo.complete(userId, missionId, completionData);
    const results = await this.gamification.processMissionCompletion(userId, missionId, mission);
    await this.analyticsRepo?.insertBehaviorEvent?.({ user_id: userId, event_type: 'mission_completed', event_data: { mission_id: missionId }, created_at: new Date().toISOString() });
    return { ok: true, results };
  }
}

// DI-provided singleton is created in container; avoid creating an un-wired instance here
export const missionService = undefined;


