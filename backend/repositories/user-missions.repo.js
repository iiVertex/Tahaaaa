import { db } from '../services/supabase.js';

export class UserMissionsRepo {
  constructor(database = db) {
    this.db = database;
  }

  byUser(userId, status = null) { return this.db.getUserMissions(userId, status); }
  async start(userId, missionId) { 
    const userMission = await this.db.startMission(userId, missionId);
    return userMission;
  }
  complete(userId, missionId, completionData) { return this.db.completeMission(userId, missionId, completionData); }
  
  async getUserMissionById(userMissionId) {
    const all = await this.db.getUserMissions(null, null);
    return all.find(um => um.id === userMissionId) || null;
  }
}

export default UserMissionsRepo;


