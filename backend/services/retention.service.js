import { logger } from '../utils/logger.js';

export class RetentionService {
  constructor(database) {
    this.db = database;
  }

  // Calculate user retention metrics
  async calculateRetentionMetrics(userId) {
    if (typeof this.db?.query !== 'function') {
      return this.getDefaultRetentionMetrics(userId);
    }

    try {
      const user = await this.db.query('users', { type: 'select' }, { 
        filters: { id: userId } 
      });
      
      if (!user || user.length === 0) {
        return this.getDefaultRetentionMetrics(userId);
      }

      const userData = Array.isArray(user) ? user[0] : user;
      const now = new Date();
      const userCreated = new Date(userData.created_at);
      const daysSinceRegistration = Math.floor((now - userCreated) / (1000 * 60 * 60 * 24));

      // Get session frequency data
      const sessions = await this.db.query('user_sessions', { type: 'select' }, {
        filters: { user_id: userId },
        orderBy: { column: 'started_at', ascending: false }
      });

      const sessionList = Array.isArray(sessions) ? sessions : [];
      
      // Calculate frequency metrics
      const frequencyScore = this.calculateFrequencyScore(sessionList, daysSinceRegistration);
      const retentionCohort = this.calculateRetentionCohort(daysSinceRegistration);
      const engagementLevel = this.calculateEngagementLevel(sessionList, daysSinceRegistration);

      // Get behavior events for deeper analysis
      const behaviorEvents = await this.db.query('user_behavior_events', { type: 'select' }, {
        filters: { user_id: userId },
        orderBy: { column: 'created_at', ascending: false }
      });

      const eventList = Array.isArray(behaviorEvents) ? behaviorEvents : [];
      const lastActive = eventList.length > 0 ? new Date(eventList[0].created_at) : userCreated;
      const daysSinceLastActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

      return {
        userId,
        daysSinceRegistration,
        daysSinceLastActive,
        totalSessions: sessionList.length,
        frequencyScore, // 0-100 scale
        retentionCohort, // 'new', 'active', 'at_risk', 'churned'
        engagementLevel, // 'low', 'medium', 'high', 'very_high'
        lastActiveAt: lastActive.toISOString(),
        isActive: daysSinceLastActive <= 7, // Active if used within last 7 days
        riskScore: this.calculateChurnRisk(daysSinceLastActive, frequencyScore, engagementLevel)
      };

    } catch (error) {
      logger.error('Retention metrics calculation error:', error);
      return this.getDefaultRetentionMetrics(userId);
    }
  }

  // Calculate frequency score based on session patterns
  calculateFrequencyScore(sessions, daysSinceRegistration) {
    if (sessions.length === 0 || daysSinceRegistration === 0) return 0;

    const totalSessions = sessions.length;
    const avgSessionsPerDay = totalSessions / Math.max(daysSinceRegistration, 1);
    
    // Score based on frequency tiers
    if (avgSessionsPerDay >= 1) return 100; // Daily user
    if (avgSessionsPerDay >= 0.5) return 80; // Every other day
    if (avgSessionsPerDay >= 0.2) return 60; // 3-4 times per week
    if (avgSessionsPerDay >= 0.1) return 40; // Weekly
    if (avgSessionsPerDay >= 0.05) return 20; // Bi-weekly
    return 10; // Monthly or less
  }

  // Determine retention cohort
  calculateRetentionCohort(daysSinceRegistration) {
    if (daysSinceRegistration <= 7) return 'new';
    if (daysSinceRegistration <= 30) return 'active';
    if (daysSinceRegistration <= 90) return 'established';
    return 'veteran';
  }

  // Calculate engagement level
  calculateEngagementLevel(sessions, daysSinceRegistration) {
    if (sessions.length === 0) return 'low';
    
    const avgSessionsPerDay = sessions.length / Math.max(daysSinceRegistration, 1);
    
    if (avgSessionsPerDay >= 0.7) return 'very_high';
    if (avgSessionsPerDay >= 0.3) return 'high';
    if (avgSessionsPerDay >= 0.1) return 'medium';
    return 'low';
  }

  // Calculate churn risk score
  calculateChurnRisk(daysSinceLastActive, frequencyScore, engagementLevel) {
    let riskScore = 0;
    
    // Days since last active (higher = more risk)
    if (daysSinceLastActive > 30) riskScore += 50;
    else if (daysSinceLastActive > 14) riskScore += 30;
    else if (daysSinceLastActive > 7) riskScore += 15;
    
    // Frequency score (lower = more risk)
    if (frequencyScore < 20) riskScore += 30;
    else if (frequencyScore < 40) riskScore += 20;
    else if (frequencyScore < 60) riskScore += 10;
    
    // Engagement level
    if (engagementLevel === 'low') riskScore += 20;
    else if (engagementLevel === 'medium') riskScore += 10;
    
    return Math.min(100, riskScore);
  }

  // Get cohort analysis for all users
  async getCohortAnalysis() {
    if (typeof this.db?.query !== 'function') {
      return { cohorts: [], summary: {} };
    }

    try {
      const users = await this.db.query('users', { type: 'select' }, {});
      const userList = Array.isArray(users) ? users : [];
      
      const cohorts = {};
      const now = new Date();
      
      for (const user of userList) {
        const userCreated = new Date(user.created_at);
        const daysSinceRegistration = Math.floor((now - userCreated) / (1000 * 60 * 60 * 24));
        
        let cohort;
        if (daysSinceRegistration <= 7) cohort = 'week_1';
        else if (daysSinceRegistration <= 30) cohort = 'month_1';
        else if (daysSinceRegistration <= 90) cohort = 'month_3';
        else cohort = 'month_6_plus';
        
        if (!cohorts[cohort]) {
          cohorts[cohort] = { total: 0, active: 0, churned: 0 };
        }
        
        cohorts[cohort].total++;
        
        // Check if user is active (simplified - would need session data)
        const lastActive = new Date(user.last_active_at || user.created_at);
        const daysSinceLastActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActive <= 7) {
          cohorts[cohort].active++;
        } else if (daysSinceLastActive > 30) {
          cohorts[cohort].churned++;
        }
      }
      
      // Calculate retention rates
      const cohortArray = Object.entries(cohorts).map(([name, data]) => ({
        cohort: name,
        totalUsers: data.total,
        activeUsers: data.active,
        churnedUsers: data.churned,
        retentionRate: data.total > 0 ? (data.active / data.total) * 100 : 0
      }));
      
      return {
        cohorts: cohortArray,
        summary: {
          totalUsers: userList.length,
          activeUsers: cohortArray.reduce((sum, c) => sum + c.activeUsers, 0),
          averageRetention: cohortArray.reduce((sum, c) => sum + c.retentionRate, 0) / cohortArray.length
        }
      };
      
    } catch (error) {
      logger.error('Cohort analysis error:', error);
      return { cohorts: [], summary: {} };
    }
  }

  // Get default metrics for fallback
  getDefaultRetentionMetrics(userId = null) {
    return {
      userId,
      daysSinceRegistration: 0,
      daysSinceLastActive: 0,
      totalSessions: 0,
      frequencyScore: 0,
      retentionCohort: 'new',
      engagementLevel: 'low',
      lastActiveAt: new Date().toISOString(),
      isActive: false,
      riskScore: 50
    };
  }

  // Track user activity for retention analysis
  async trackActivity(userId, activityType, metadata = {}) {
    if (typeof this.db?.query !== 'function') return;

    try {
      // Update last_active_at in users table
      await this.db.query('users', { type: 'update' }, {
        filters: { id: userId },
        data: { last_active_at: new Date().toISOString() }
      });

      // Log activity event
      await this.db.query('user_behavior_events', { type: 'insert' }, {
        data: {
          user_id: userId,
          event_type: activityType,
          event_data: metadata,
          created_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Activity tracking error:', error);
    }
  }
}
