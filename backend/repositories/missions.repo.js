import { db } from '../services/supabase.js';

export class MissionsRepo {
  constructor(database = db) {
    this.db = database;
  }

  list(filters) { return this.db.getMissions(filters); }
  getById(id) { return this.db.getMissionById(id); }
  
  async create(missionData) {
    // Store mission in database
    if (this.db && typeof this.db.createMission === 'function') {
      return await this.db.createMission(missionData);
    }
    // Fallback: just return the mission data (for mock DB or when method doesn't exist)
    return missionData;
  }
}

export default MissionsRepo;


