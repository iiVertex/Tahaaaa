import { db } from '../services/supabase.js';

export class MissionsRepo {
  constructor(database = db) {
    this.db = database;
  }

  list(filters) { return this.db.getMissions(filters); }
  getById(id) { return this.db.getMissionById(id); }
}

export default MissionsRepo;


