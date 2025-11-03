import { db } from '../services/supabase.js';

export class UserMissionsRepo {
  constructor(database = db) {
    this.db = database;
  }

  async byUser(userId, status = null) { 
    const result = await this.db.getUserMissions(userId, status);
    // Ensure we always return an array
    return Array.isArray(result) ? result : (result ? [result] : []);
  }
  async start(userId, missionId) { 
    const userMission = await this.db.startMission(userId, missionId);
    return userMission;
  }
  async complete(userId, missionId, completionData) { 
    const result = await this.db.completeMission(userId, missionId, completionData);
    return result;
  }
  
  async getUserMissionById(userMissionId) {
    const all = await this.db.getUserMissions(null, null);
    return all.find(um => um.id === userMissionId) || null;
  }
}

export default UserMissionsRepo;

