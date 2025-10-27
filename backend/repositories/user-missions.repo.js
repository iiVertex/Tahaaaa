import { db } from '../services/supabase.js';

export class UserMissionsRepo {
  constructor(database = db) {
    this.db = database;
  }

  byUser(userId, status = null) { return this.db.getUserMissions(userId, status); }
  start(userId, missionId) { return this.db.startMission(userId, missionId); }
  complete(userId, missionId, completionData) { return this.db.completeMission(userId, missionId, completionData); }
}

export default UserMissionsRepo;


