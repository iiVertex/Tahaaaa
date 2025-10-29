import { logger } from '../utils/logger.js';

export class EcosystemService {
  constructor(database) {
    this.db = database;
    this.memory = { eventsByUserId: new Map() };
  }

  // Track feature utilization across the app ecosystem
  async trackFeatureUsage(userId, featureName, metadata = {}) {
    try {
      const event = {
        user_id: userId,
        event_type: 'feature_usage',
        event_data: {
          feature_name: featureName,
          ...metadata
        },
        created_at: new Date().toISOString()
      };

      if (typeof this.db?.query !== 'function') {
        // In-memory fallback
        const list = this.memory.eventsByUserId.get(userId) || [];
        list.unshift(event);
        this.memory.eventsByUserId.set(userId, list);
        
        logger.info('Feature usage tracked in-memory (fallback)', { userId, featureName, metadata });
        return { success: true };
      }

      // Record feature usage event
      await this.db.query('user_behavior_events', { type: 'insert' }, {
        data: event
      });

      // Update ecosystem utilization metrics
      await this.updateEcosystemMetrics(userId, featureName);

      logger.info('Feature usage tracked', { userId, featureName, metadata });
      return { success: true };

    } catch (error) {
      logger.error('Feature usage tracking error:', error);
      return { success: false, message: 'Failed to track feature usage' };
    }
  }

  // Get ecosystem utilization metrics for a user
  async getEcosystemMetrics(userId) {
    try {
      if (typeof this.db?.query !== 'function') {
        const events = this.memory.eventsByUserId.get(userId) || [];
        const featureUsage = this.calculateFeatureUsage(events);
        const ecosystemHealth = this.calculateEcosystemHealth(featureUsage);
        const engagementScore = this.calculateEngagementScore(featureUsage);

        return {
          userId,
          featureUsage,
          ecosystemHealth,
          engagementScore,
          lastUpdated: new Date().toISOString()
        };
      }

      // Get all feature usage events for the user
      const events = await this.db.query('user_behavior_events', { type: 'select' }, {
        filters: { 
          user_id: userId,
          event_type: 'feature_usage'
        },
        orderBy: { column: 'created_at', ascending: false }
      });

      const eventList = Array.isArray(events) ? events : [];
      const featureUsage = this.calculateFeatureUsage(eventList);
      const ecosystemHealth = this.calculateEcosystemHealth(featureUsage);
      const engagementScore = this.calculateEngagementScore(featureUsage);

      return {
        userId,
        featureUsage,
        ecosystemHealth,
        engagementScore,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Ecosystem metrics error:', error);
      return this.getDefaultEcosystemMetrics(userId);
    }
  }

  // Calculate feature usage statistics
  calculateFeatureUsage(events) {
    const features = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    events.forEach(event => {
      const featureName = event.event_data?.feature_name || 'unknown';
      const eventDate = new Date(event.created_at);

      if (!features[featureName]) {
        features[featureName] = {
          totalUsage: 0,
          lastUsed: null,
          recentUsage: 0, // Last 30 days
          averageFrequency: 0,
          firstUsed: null
        };
      }

      features[featureName].totalUsage++;
      
      if (!features[featureName].firstUsed || eventDate < new Date(features[featureName].firstUsed)) {
        features[featureName].firstUsed = eventDate.toISOString();
      }
      
      if (!features[featureName].lastUsed || eventDate > new Date(features[featureName].lastUsed)) {
        features[featureName].lastUsed = eventDate.toISOString();
      }

      if (eventDate >= thirtyDaysAgo) {
        features[featureName].recentUsage++;
      }
    });

    // Calculate average frequency for each feature
    Object.keys(features).forEach(featureName => {
      const feature = features[featureName];
      if (feature.firstUsed) {
        const daysSinceFirst = Math.max(1, Math.floor((now - new Date(feature.firstUsed)) / (1000 * 60 * 60 * 24)));
        feature.averageFrequency = feature.totalUsage / daysSinceFirst;
      }
    });

    return features;
  }

  // Calculate ecosystem health score
  calculateEcosystemHealth(featureUsage) {
    const features = Object.keys(featureUsage);
    if (features.length === 0) return { score: 0, level: 'inactive', recommendations: [] };

    const totalFeatures = 8; // Total available features in the ecosystem
    const utilizedFeatures = features.length;
    const utilizationRate = utilizedFeatures / totalFeatures;

    // Calculate engagement diversity
    const activeFeatures = features.filter(f => featureUsage[f].recentUsage > 0);
    const diversityScore = activeFeatures.length / totalFeatures;

    // Calculate frequency score
    const avgFrequency = features.reduce((sum, f) => sum + featureUsage[f].averageFrequency, 0) / features.length;
    const frequencyScore = Math.min(1, avgFrequency / 0.5); // Normalize to 0-1

    const healthScore = (utilizationRate * 0.4 + diversityScore * 0.3 + frequencyScore * 0.3) * 100;

    let level, recommendations = [];
    
    if (healthScore >= 80) {
      level = 'excellent';
      recommendations = ['Maintain current engagement level', 'Explore advanced features'];
    } else if (healthScore >= 60) {
      level = 'good';
      recommendations = ['Try new features', 'Increase usage frequency'];
    } else if (healthScore >= 40) {
      level = 'fair';
      recommendations = ['Complete onboarding', 'Try mission system', 'Explore rewards'];
    } else {
      level = 'poor';
      recommendations = ['Start with basic features', 'Complete profile setup', 'Try daily missions'];
    }

    return {
      score: Math.round(healthScore),
      level,
      utilizationRate: Math.round(utilizationRate * 100),
      diversityScore: Math.round(diversityScore * 100),
      frequencyScore: Math.round(frequencyScore * 100),
      recommendations
    };
  }

  // Calculate overall engagement score
  calculateEngagementScore(featureUsage) {
    const features = Object.keys(featureUsage);
    if (features.length === 0) return 0;

    const weights = {
      'mission_complete': 0.3,
      'scenario_simulate': 0.2,
      'reward_redeem': 0.2,
      'profile_update': 0.1,
      'achievement_earn': 0.1,
      'social_share': 0.1
    };

    let weightedScore = 0;
    let totalWeight = 0;

    features.forEach(featureName => {
      const weight = weights[featureName] || 0.05; // Default weight for unknown features
      const feature = featureUsage[featureName];
      const score = Math.min(100, feature.recentUsage * 10 + feature.averageFrequency * 20);
      
      weightedScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  }

  // Update ecosystem metrics in user profile
  async updateEcosystemMetrics(userId, featureName) {
    if (typeof this.db?.query !== 'function') return;

    try {
      const metrics = await this.getEcosystemMetrics(userId);
      
      // Update user profile with ecosystem metrics
      await this.db.query('users', { type: 'update' }, {
        filters: { id: userId },
        data: {
          ecosystem_health_score: metrics.ecosystemHealth.score,
          ecosystem_engagement_score: metrics.engagementScore,
          features_utilized: Object.keys(metrics.featureUsage).length,
          last_ecosystem_update: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Update ecosystem metrics error:', error);
    }
  }

  // Get ecosystem analytics for all users
  async getEcosystemAnalytics() {
    if (typeof this.db?.query !== 'function') {
      return { totalUsers: 0, averageHealth: 0, featurePopularity: {} };
    }

    try {
      const users = await this.db.query('users', { type: 'select' }, {});
      const userList = Array.isArray(users) ? users : [];
      
      let totalHealth = 0;
      let activeUsers = 0;
      const featurePopularity = {};

      for (const user of userList) {
        const metrics = await this.getEcosystemMetrics(user.id);
        
        if (metrics.ecosystemHealth.score > 0) {
          totalHealth += metrics.ecosystemHealth.score;
          activeUsers++;
        }

        // Count feature popularity
        Object.keys(metrics.featureUsage).forEach(feature => {
          featurePopularity[feature] = (featurePopularity[feature] || 0) + 1;
        });
      }

      const averageHealth = activeUsers > 0 ? Math.round(totalHealth / activeUsers) : 0;

      return {
        totalUsers: userList.length,
        activeUsers,
        averageHealth,
        featurePopularity: Object.entries(featurePopularity)
          .sort(([,a], [,b]) => b - a)
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
      };

    } catch (error) {
      logger.error('Ecosystem analytics error:', error);
      return { totalUsers: 0, averageHealth: 0, featurePopularity: {} };
    }
  }

  // Get default metrics for fallback
  getDefaultEcosystemMetrics(userId = null) {
    return {
      userId,
      featureUsage: {},
      ecosystemHealth: {
        score: 0,
        level: 'inactive',
        utilizationRate: 0,
        diversityScore: 0,
        frequencyScore: 0,
        recommendations: ['Start using the app features']
      },
      engagementScore: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}
