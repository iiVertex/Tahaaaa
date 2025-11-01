import { logger } from '../utils/logger.js';

export default class PlayActivityRepo {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get play activities by user and date
   * @param {string} userId
   * @param {string} activityDate - YYYY-MM-DD format
   * @param {string} activityType - Optional filter by type (e.g., 'roulette_spin')
   * @returns {Promise<Array>}
   */
  async getByUserAndDate(userId, activityDate, activityType = null) {
    try {
      if (this.db.isMock) {
        const mockData = this.db.play_activity || [];
        let filtered = mockData.filter(a => 
          a.user_id === userId && 
          a.activity_date === activityDate
        );
        if (activityType) {
          filtered = filtered.filter(a => a.activity_type === activityType);
        }
        return filtered;
      }

      // Real Supabase query - use generic query method if available
      const filters = { user_id: userId, activity_date: activityDate };
      if (activityType) {
        filters.activity_type = activityType;
      }
      
      const results = await this.db.query('play_activity', { type: 'select' }, { filters });
      return Array.isArray(results) ? results : [];
    } catch (error) {
      logger.error('Error getting play activity by user and date:', error);
      return [];
    }
  }

  /**
   * Create a new play activity record
   * @param {Object} activityData
   * @returns {Promise<Object>}
   */
  async create(activityData) {
    try {
      if (this.db.isMock) {
        const mockData = this.db.play_activity || [];
        const newActivity = {
          id: `play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...activityData,
          created_at: new Date().toISOString()
        };
        mockData.push(newActivity);
        return newActivity;
      }

      // Real Supabase insert - use generic query method
      const results = await this.db.query('play_activity', { type: 'insert' }, { data: activityData });
      return Array.isArray(results) ? results[0] : results;
    } catch (error) {
      logger.error('Error creating play activity:', error);
      throw error;
    }
  }
}

