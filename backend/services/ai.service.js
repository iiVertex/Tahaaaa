import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Lovable.dev AI service (mocked initially)
class AIService {
  constructor() {
    this.apiKey = process.env.LOVABLE_API_KEY;
    this.baseURL = 'https://api.lovable.dev'; // Placeholder URL
    this.provider = config.aiProvider || 'local';
    this.isMockMode = this.provider === 'local' || !this.apiKey || process.env.NODE_ENV === 'development';
  }

  // Generate mission recommendations based on user profile
  async generateMissionRecommendations(userId, userProfile) {
    try {
      if (this.isMockMode) {
        return this.getMockRecommendations(userProfile);
      }

      // TODO: Implement real Lovable.dev API call
      const response = await axios.post(`${this.baseURL}/recommendations`, {
        userId,
        profile: userProfile,
        type: 'missions'
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('AI recommendation error:', error);
      // Fallback to mock data
      return this.getMockRecommendations(userProfile);
    }
  }

  // Generate AI profile from onboarding data
  async generateAIProfile(onboardingData) {
    try {
      if (this.isMockMode) {
        return this.getMockProfile(onboardingData);
      }

      // TODO: Implement real Lovable.dev API call
      const response = await axios.post(`${this.baseURL}/profile`, {
        onboardingData
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('AI profile generation error:', error);
      // Fallback to mock data
      return this.getMockProfile(onboardingData);
    }
  }

  // Predict scenario outcomes (legacy)
  async predictScenarioOutcome(scenarioInputs) {
    try {
      if (this.isMockMode) {
        return this.getMockScenarioPrediction(scenarioInputs);
      }

      // TODO: Implement real Lovable.dev API call
      const response = await axios.post(`${this.baseURL}/scenarios`, {
        inputs: scenarioInputs
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('AI scenario prediction error:', error);
      // Fallback to mock data
      return this.getMockScenarioPrediction(scenarioInputs);
    }
  }

  // New: Deterministic scenario prediction used by ScenarioService
  /**
   * @param {string} userId
   * @param {Record<string, any>} inputs
   */
  async generateScenarioPrediction(userId, inputs) {
    // No network: compute deterministic, explainable results
    const normalized = this.normalizeInputs(inputs);
    const scoreDelta = this.computeLifeScoreDelta(normalized);
    const xp = this.computeXPReward(normalized, scoreDelta);
    const risk = this.computeRiskLevel(normalized);
    const narrative = this.buildNarrative(normalized, scoreDelta, risk);
    const suggested_missions = this.buildSuggestedMissions(normalized, scoreDelta, xp);
    return {
      lifescore_impact: scoreDelta,
      xp_reward: xp,
      risk_level: risk,
      narrative,
      suggested_missions
    };
  }

  /**
   * Recommend adaptive missions without network.
   * @param {string} userId
   * @param {Record<string, any>} context
   */
  async recommendAdaptiveMissions(userId, context = {}) {
    const base = this.buildSuggestedMissions(this.normalizeInputs(context), 8, 40);
    return base.map(m => ({ ...m, reason: 'Adaptive recommendation', ai_generated: true }));
  }

  /**
   * Predict insights for dashboard without network.
   * @param {string} userId
   */
  async predictInsights(userId) {
    // Simple placeholder insights; real version would use behavior + profile
    return [
      { title: 'Quick win: 15-min walk', detail: 'Walking daily can raise LifeScore ~3 in a week.', confidence: 0.82 },
      { title: 'Maintain streak', detail: 'Completing one mission today protects your streak.', confidence: 0.76 },
      { title: 'Sync health data', detail: 'Connecting health portal unlocks more precise missions.', confidence: 0.64 }
    ];
  }

  // Mock data generators
  getMockRecommendations(userProfile) {
    const { integrations = [], risk_profile = {} } = userProfile;
    
    const recommendations = [
      {
        id: 'rec-1',
        type: 'mission',
        title: 'Daily Health Check',
        description: 'Complete your daily health assessment',
        priority: 'high',
        reason: 'Based on your health focus',
        xp_reward: 50,
        lifescore_impact: 10
      },
      {
        id: 'rec-2',
        type: 'mission',
        title: 'Safe Driving Challenge',
        description: 'Maintain safe driving habits for a week',
        priority: 'medium',
        reason: 'Improve your driving score',
        xp_reward: 75,
        lifescore_impact: 15
      }
    ];

    // Add integration-specific recommendations
    if (integrations.includes('QIC Health Portal')) {
      recommendations.push({
        id: 'rec-3',
        type: 'mission',
        title: 'Health Portal Sync',
        description: 'Sync your health data with QIC Health Portal',
        priority: 'high',
        reason: 'You have QIC Health Portal integration',
        xp_reward: 100,
        lifescore_impact: 20
      });
    }

    return recommendations;
  }

  getMockProfile(onboardingData) {
    const { step1, step2, step3, step4, step5, step6 } = onboardingData;
    
    return {
      risk_level: step1?.risk_tolerance || 'medium',
      health_score: this.calculateHealthScore(step2),
      family_priority: step3?.dependents > 0 ? 'high' : 'low',
      financial_goals: step4?.investment_risk || 'moderate',
      insurance_focus: step5?.coverage_types || ['health'],
      integrations: step6?.integrations || [],
      ai_personality: 'encouraging',
      notification_preferences: {
        missions: true,
        achievements: true,
        reminders: true,
        social: false
      },
      personalized_tips: [
        'Focus on building healthy habits',
        'Consider family protection options',
        'Regular health checkups are important'
      ]
    };
  }

  getMockScenarioPrediction(scenarioInputs) {
    const { type, inputs } = scenarioInputs;
    
    const basePrediction = {
      risk_level: 'medium',
      confidence: 0.75,
      recommendations: [],
      potential_outcomes: []
    };

    switch (type) {
      case 'lifestyle_change':
        return {
          ...basePrediction,
          risk_level: 'low',
          confidence: 0.85,
          recommendations: [
            'Gradual lifestyle changes are more sustainable',
            'Track your progress regularly',
            'Consider professional guidance'
          ],
          potential_outcomes: [
            'Improved health score',
            'Better insurance rates',
            'Increased LifeScore'
          ]
        };

      case 'policy_change':
        return {
          ...basePrediction,
          risk_level: 'medium',
          confidence: 0.70,
          recommendations: [
            'Review current coverage gaps',
            'Consider family needs',
            'Compare different options'
          ],
          potential_outcomes: [
            'Better coverage',
            'Cost savings',
            'Improved protection'
          ]
        };

      default:
        return basePrediction;
    }
  }

  // ---------- Deterministic helpers ----------
  normalizeInputs(inputs = {}) {
    return {
      walk_minutes: Number(inputs.walk_minutes || 0),
      diet_quality: String(inputs.diet_quality || 'fair'),
      commute_distance: Number(inputs.commute_distance || 0),
      driving_hours: Number(inputs.driving_hours || 0),
      seatbelt_usage: String(inputs.seatbelt_usage || 'often')
    };
  }

  computeLifeScoreDelta(n) {
    let delta = 0;
    // Movement impact
    if (n.walk_minutes > 0) delta += Math.min(10, Math.floor(n.walk_minutes / 10));
    // Diet impact
    const dietMap = { excellent: 8, good: 5, fair: 2, poor: -4 };
    delta += dietMap[n.diet_quality] ?? 2;
    // Commute/driving risk
    if (n.commute_distance > 30 || n.driving_hours > 2) delta -= 3;
    if (n.seatbelt_usage === 'always') delta += 3; else if (n.seatbelt_usage === 'rarely') delta -= 4;
    return Math.max(1, Math.min(20, delta));
  }

  computeXPReward(n, delta) {
    const base = 20 + delta * 3;
    const penalty = (n.seatbelt_usage === 'rarely') ? 5 : 0;
    return Math.max(10, Math.min(100, base - penalty));
  }

  computeRiskLevel(n) {
    let risk = 0;
    if (n.commute_distance > 25) risk += 1;
    if (n.driving_hours > 2) risk += 1;
    if (n.seatbelt_usage !== 'always') risk += 1;
    if (n.walk_minutes >= 30 && (n.diet_quality === 'good' || n.diet_quality === 'excellent')) risk -= 1;
    return risk <= 0 ? 'low' : risk === 1 ? 'medium' : 'high';
  }

  buildNarrative(n, delta, risk) {
    const parts = [];
    if (n.walk_minutes >= 30) parts.push('Adding daily walking improves cardiovascular health.');
    if (n.diet_quality === 'excellent' || n.diet_quality === 'good') parts.push('Your diet supports sustained energy and recovery.');
    if (n.commute_distance > 25 || n.driving_hours > 2) parts.push('Long commutes increase incident risk; consider route or timing changes.');
    if (n.seatbelt_usage !== 'always') parts.push('Always wearing a seatbelt significantly reduces injury risk.');
    parts.push(`Overall impact preview: LifeScore +${delta}, Risk ${risk}.`);
    return parts.join(' ');
  }

  buildSuggestedMissions(n, delta, xp) {
    const missions = [];
    if (n.walk_minutes < 30) {
      missions.push({ id: 'ai-walk-30', title: 'Walk 30 minutes today', category: 'health', difficulty: 'easy', xp_reward: Math.max(20, xp - 10), lifescore_impact: Math.max(3, Math.floor(delta / 2)), ai_generated: true });
    }
    if (n.diet_quality !== 'excellent') {
      missions.push({ id: 'ai-meal-plan', title: 'Plan 3 balanced meals', category: 'health', difficulty: 'medium', xp_reward: xp, lifescore_impact: Math.max(4, Math.floor(delta / 2)), ai_generated: true });
    }
    if (n.seatbelt_usage !== 'always') {
      missions.push({ id: 'ai-seatbelt', title: 'Seatbelt Habit Challenge', category: 'safe_driving', difficulty: 'easy', xp_reward: 25, lifescore_impact: 5, ai_generated: true });
    }
    if (missions.length === 0) {
      missions.push({ id: 'ai-checkup', title: 'Schedule a health check', category: 'health', difficulty: 'easy', xp_reward: 30, lifescore_impact: 4, ai_generated: true });
    }
    return missions;
  }

  calculateHealthScore(step2Data) {
    if (!step2Data) return 50;
    
    let score = 50; // Base score
    
    // Exercise frequency (0-7 days)
    score += (step2Data.exercise_frequency || 0) * 5;
    
    // Diet quality
    const dietScores = { excellent: 20, good: 10, fair: 0, poor: -10 };
    score += dietScores[step2Data.diet_quality] || 0;
    
    // Daily routine
    const routineScores = { active: 15, moderate: 5, sedentary: -5 };
    score += routineScores[step2Data.daily_routine] || 0;
    
    return Math.min(Math.max(score, 0), 100);
  }
}

// Export singleton instance
export const aiService = new AIService();
