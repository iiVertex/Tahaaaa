import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

let OpenAIClient = null;
try {
  const module = await import('openai');
  OpenAIClient = module.default || module.OpenAI || null;
} catch (_) {
  OpenAIClient = null;
}

// Lovable.dev AI service (mocked initially)
class AIService {
  constructor() {
    this.provider = (process.env.AI_PROVIDER || config.aiProvider || 'local').toLowerCase();
    // OpenAI settings
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-5-nano';
    this.openaiTemperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.7);
    this.openaiMaxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? 600);
    // Legacy Lovable placeholders (fallback if provider chosen differently)
    this.apiKey = process.env.LOVABLE_API_KEY;
    this.baseURL = 'https://api.lovable.dev';
    this.isMockMode = this.provider === 'local' || (this.provider === 'openai' && !this.openaiApiKey);

    if (this.provider === 'openai' && this.openaiApiKey && OpenAIClient) {
      this.openai = new OpenAIClient({ apiKey: this.openaiApiKey });
    } else {
      this.openai = null;
    }
  }

  async sendOpenAiPrompt(prompt, { maxTokens, temperature } = {}) {
    if (!this.openai) return null;
    try {
      const response = await this.openai.responses.create({
        model: this.openaiModel,
        input: prompt,
        temperature: typeof temperature === 'number' ? temperature : this.openaiTemperature,
        max_output_tokens: typeof maxTokens === 'number' ? maxTokens : this.openaiMaxTokens,
        response_format: { type: 'text' }
      });
      return this.extractTextFromResponse(response);
    } catch (error) {
      logger.error('OpenAI prompt error', { error: error?.message });
      throw error;
    }
  }

  extractTextFromResponse(response) {
    if (!response) return '';
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }
    if (Array.isArray(response.output)) {
      const text = response.output
        .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
        .map((chunk) => {
          if (!chunk) return '';
          if (typeof chunk.text === 'string') return chunk.text;
          if (chunk.type === 'output_text' && chunk.text?.value) return chunk.text.value;
          if (chunk.type === 'text' && chunk.text?.value) return chunk.text.value;
          return '';
        })
        .join('')
        .trim();
      if (text) return text;
    }
    return '';
  }

  // Generate mission recommendations based on user profile
  async generateMissionRecommendations(userId, userProfile) {
    try {
      if (this.isMockMode) {
        // Rule-based recommendations using profile hints
        const integrations = userProfile?.integrations || userProfile?.step6?.integrations || [];
        const drivingHours = userProfile?.driving_hours || userProfile?.step1?.driving_habits === 'aggressive' ? 3 : 1;
        const lastPolicyReviewDays = userProfile?.policy_review_days || 120;
        const lifeScore = userProfile?.lifescore || 50;

        const recs = [];
        if (lifeScore < 50) {
          recs.push({ id: 'rec-health-1', type: 'mission', title: 'Hydration Habit', description: 'Drink 8 glasses of water', priority: 'high', xp_reward: 30, lifescore_impact: 6 });
        }
        if (drivingHours > 2) {
          recs.push({ id: 'rec-drive-1', type: 'mission', title: 'Safe Driving Week', description: 'Maintain safe driving for 7 days', priority: 'medium', xp_reward: 60, lifescore_impact: 8 });
        }
        if (lastPolicyReviewDays > 90) {
          recs.push({ id: 'rec-policy-1', type: 'mission', title: 'Policy Review', description: 'Review your policy details', priority: 'medium', xp_reward: 20, lifescore_impact: 3 });
        }
        if (integrations.includes('QIC Health Portal')) {
          recs.push({ id: 'rec-sync-1', type: 'mission', title: 'Sync Health Data', description: 'Sync your health data for better insights', priority: 'high', xp_reward: 40, lifescore_impact: 7 });
        }
        return recs.length ? recs : this.getMockRecommendations(userProfile);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this.buildRecommendationPrompt(userProfile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 600 });
        return this.parseRecommendationsResponse(raw);
      }
      // Fallback generic HTTP provider (legacy)
      const response = await axios.post(`${this.baseURL}/recommendations`, { userId, profile: userProfile, type: 'missions' }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } });
      return response?.data;
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
        // Map onboarding responses to concise AI profile
        const step1 = onboardingData?.step1 || {};
        const step2 = onboardingData?.step2 || {};
        const step3 = onboardingData?.step3 || {};
        const step4 = onboardingData?.step4 || {};
        const step5 = onboardingData?.step5 || {};
        const step6 = onboardingData?.step6 || {};
        return {
          risk_level: step1?.risk_tolerance || 'medium',
          health_score: this.calculateHealthScore(step2),
          family_priority: step3?.dependents > 0 ? 'high' : 'low',
          financial_goals: step4?.investment_risk || 'moderate',
          insurance_focus: step5?.coverage_types || ['health'],
          integrations: step6?.integrations || [],
          ai_personality: 'encouraging'
        };
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this.buildProfilePrompt(onboardingData);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 400 });
        return this.parseJsonOrFallback(raw, () => this.getMockProfile(onboardingData));
      }
      const response = await axios.post(`${this.baseURL}/profile`, { onboardingData }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } });
      return response?.data;
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
        // Deterministic local prediction for explainability
        const userId = scenarioInputs?.user_id || 'local';
        return this.generateScenarioPrediction(userId, scenarioInputs?.inputs || {});
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this.buildScenarioPrompt(scenarioInputs);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 800 });
        return this.parseJsonOrFallback(raw, () => this.getMockScenarioPrediction(scenarioInputs));
      }
      const response = await axios.post(`${this.baseURL}/scenarios`, { inputs: scenarioInputs }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } });
      return response?.data;
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
    // Use recent behavior summary to tailor insights
    let summary = null;
    try {
      const { container } = await import('../di/container.js');
      summary = await container.repos.analytics.getBehaviorSummary(userId);
    } catch (_) {}
    const insights = [];
    if (!summary || summary.lifescore_trend === 'down') {
      insights.push({ title: 'Quick win: 15-min walk', detail: 'Walking daily can raise LifeScore ~3 in a week.', confidence: 0.82 });
    }
    if (!summary || (summary.streak_days || 0) === 0) {
      insights.push({ title: 'Maintain streak', detail: 'Completing one mission today protects your streak.', confidence: 0.76 });
    }
    insights.push({ title: 'Sync health data', detail: 'Connecting health portal unlocks more precise missions.', confidence: 0.64 });
    return insights;
  }

  // Mock data generators
  buildRecommendationPrompt(userProfile) {
    return `Based on this user profile: ${JSON.stringify(userProfile)}\n\nRecommend 3-5 personalized insurance-related missions. For each mission provide: title, category (safe_driving|health|financial_guardian|family_protection|lifestyle), difficulty (easy|medium|hard), reason (1 sentence), xp_reward (int), lifescore_impact (int). Return as JSON array.`;
  }
  buildScenarioPrompt(scenarioInputs) {
    return `Analyze this life scenario: ${JSON.stringify(scenarioInputs)}\n\nPredict: lifescore_impact (int -50..50), risk_level (low|medium|high), narrative (2-3 sentences), suggested_missions (array of {id,title,category,xp_reward,lifescore_impact}). Return as JSON.`;
  }
  buildProfilePrompt(onboardingData) {
    return `Generate AI profile from onboarding: ${JSON.stringify(onboardingData)}\n\nReturn JSON with: risk_level (low|medium|high), health_score (0..100), family_priority (low|medium|high), financial_goals (conservative|moderate|aggressive), insurance_focus (array), ai_personality (encouraging|competitive|educational|supportive).`;
  }

  // Analyze behavioral patterns for enhanced personalization
  async analyzeBehavioralPatterns(userId, behaviorEvents) {
    if (this.isMockMode) {
      return this._mockBehavioralAnalysis(behaviorEvents);
    }

    try {
      const prompt = this._buildBehavioralAnalysisPrompt(behaviorEvents);
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.6
      });

      return this._parseBehavioralAnalysis(response.choices[0].message.content);
    } catch (error) {
      logger.error('OpenAI API error for behavioral analysis, falling back to mock', error);
      return this._mockBehavioralAnalysis(behaviorEvents);
    }
  }

  // Generate engagement strategies based on user patterns
  async generateEngagementStrategies(userId, userProfile, behaviorPatterns) {
    if (this.isMockMode) {
      return this._mockEngagementStrategies(userProfile);
    }

    try {
      const prompt = this._buildEngagementPrompt(userProfile, behaviorPatterns);
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8
      });

      return this._parseEngagementStrategies(response.choices[0].message.content);
    } catch (error) {
      logger.error('OpenAI API error for engagement strategies, falling back to mock', error);
      return this._mockEngagementStrategies(userProfile);
    }
  }
  parseRecommendationsResponse(content) {
    try { const parsed = JSON.parse(content || '[]'); return Array.isArray(parsed) ? parsed : (parsed.missions || []); } catch { return this.getMockRecommendations({}); }
  }
  parseJsonOrFallback(content, fallbackFn) {
    try { return JSON.parse(content || '{}'); } catch { return fallbackFn(); }
  }

  // Behavioral analysis helper methods
  _buildBehavioralAnalysisPrompt(behaviorEvents) {
    return `Analyze these user behavior events: ${JSON.stringify(behaviorEvents)}\n\nIdentify patterns and return JSON with: engagement_level (low|medium|high), preferred_activity_times (array), mission_completion_rate (0-1), churn_risk (low|medium|high), personalization_insights (array of strings), recommended_engagement_frequency (daily|weekly|monthly).`;
  }

  _buildEngagementPrompt(userProfile, behaviorPatterns) {
    return `Based on user profile: ${JSON.stringify(userProfile)} and behavior patterns: ${JSON.stringify(behaviorPatterns)}\n\nGenerate engagement strategies as JSON with: notification_timing (array of optimal times), content_preferences (array), mission_difficulty_preference (easy|medium|hard), reward_motivation (xp|coins|achievements|social), retention_strategies (array of strings).`;
  }

  _parseBehavioralAnalysis(content) {
    try {
      return JSON.parse(content || '{}');
    } catch {
      return this._mockBehavioralAnalysis([]);
    }
  }

  _parseEngagementStrategies(content) {
    try {
      return JSON.parse(content || '{}');
    } catch {
      return this._mockEngagementStrategies({});
    }
  }

  _mockBehavioralAnalysis(behaviorEvents) {
    return {
      engagement_level: 'medium',
      preferred_activity_times: ['morning', 'evening'],
      mission_completion_rate: 0.65,
      churn_risk: 'low',
      personalization_insights: [
        'Responds well to health-focused missions',
        'Prefers short, achievable goals',
        'Engages more on weekends'
      ],
      recommended_engagement_frequency: 'daily'
    };
  }

  _mockEngagementStrategies(userProfile) {
    return {
      notification_timing: ['09:00', '18:00'],
      content_preferences: ['health', 'safety', 'family'],
      mission_difficulty_preference: 'medium',
      reward_motivation: 'achievements',
      retention_strategies: [
        'Send weekly progress summaries',
        'Create family-focused challenges',
        'Offer health milestone rewards'
      ]
    };
  }
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
