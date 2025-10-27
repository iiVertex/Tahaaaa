import axios from 'axios';
import { logger } from '../utils/logger.js';

// Lovable.dev AI service (mocked initially)
class AIService {
  constructor() {
    this.apiKey = process.env.LOVABLE_API_KEY;
    this.baseURL = 'https://api.lovable.dev'; // Placeholder URL
    this.isMockMode = !this.apiKey || process.env.NODE_ENV === 'development';
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

  // Predict scenario outcomes
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
