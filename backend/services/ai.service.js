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
    
    // Calculate severity score (1-10) based on risk and scenario factors
    const severityScore = Math.min(10, Math.max(1, 
      (risk === 'high' ? 8 : risk === 'medium' ? 5 : 3) + 
      (Math.abs(scoreDelta) > 20 ? 2 : Math.abs(scoreDelta) > 10 ? 1 : 0)
    ));
    
    // Generate recommended plans with relevance scores (mock for offline)
    const category = normalized.category || normalized.type || 'car';
    const recommendedPlans = this.generateRecommendedPlansWithScores(category, normalized, severityScore);
    
    return {
      lifescore_impact: scoreDelta,
      xp_reward: xp,
      risk_level: risk,
      narrative,
      suggested_missions,
      severity_score: severityScore,
      recommended_plans: recommendedPlans
    };
  }
  
  // Generate recommended plans with relevance scores (1-10) for offline mode
  generateRecommendedPlansWithScores(category, normalized, severityScore) {
    // Mock plans - in production, this would use actual QIC product catalog
    const plans = [];
    const baseRelevance = 8;
    
    // Match category-specific plans
    if (category === 'car' || category === 'motorcycle') {
      plans.push({
        plan_id: 'qic-comprehensive-car',
        plan_name: 'QIC Comprehensive Car Insurance',
        plan_type: category,
        relevance_score: baseRelevance + (normalized.user_profile?.first_time_buyer ? 1 : 0),
        description: 'Full coverage with agency repair option for vehicles 1-3 years old',
        qatar_compliance: 'Complies with Qatar TPI requirements, includes GCC coverage option',
        estimated_premium: 'QAR 1,200 - 3,500',
        key_features: ['Agency repair', 'TPI compliance', 'GCC coverage add-on']
      });
      plans.push({
        plan_id: 'qic-tpl-car',
        plan_name: 'QIC Third Party Liability',
        plan_type: category,
        relevance_score: baseRelevance - 2,
        description: 'Basic TPL coverage as required by Qatari law',
        qatar_compliance: 'Meets minimum QCB requirements for vehicle insurance',
        estimated_premium: 'QAR 500 - 1,200',
        key_features: ['Legal compliance', 'Affordable', 'Minimum coverage']
      });
    } else if (category === 'travel') {
      plans.push({
        plan_id: 'qic-schengen-travel',
        plan_name: 'QIC Schengen Travel Insurance',
        plan_type: category,
        relevance_score: baseRelevance + 1,
        description: 'Visa-compliant coverage for Schengen countries with EUR 30,000 minimum',
        qatar_compliance: 'Meets Schengen visa requirements, valid for Qatari residents',
        estimated_premium: 'QAR 200 - 800',
        key_features: ['Schengen visa compliance', 'EUR 30,000 medical', 'Baggage protection']
      });
    } else if (category === 'home') {
      plans.push({
        plan_id: 'qic-home-contents',
        plan_name: 'QIC Home Contents Insurance',
        plan_type: category,
        relevance_score: baseRelevance,
        description: 'Comprehensive contents coverage for apartments and villas',
        qatar_compliance: 'Covers Qatar-specific risks (sandstorms, flash floods)',
        estimated_premium: 'QAR 800 - 2,500',
        key_features: ['Contents protection', 'Natural disaster coverage', 'Theft protection']
      });
    }
    
    // Sort by relevance (highest first) and limit to top 5
    return plans.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 5);
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
   * Generate personalized missions for a user based on their complete profile.
   * This is used when user clicks "Generate Missions" button on Missions page.
   * 
   * Grand Strategy Alignment:
   * - Gamification: Engage users through personalized missions
   * - Multi-product conversion: Missions promote different QIC products
   * - Retention: Missions encourage frequent app return
   * - Ecosystem utilization: Missions connect to QIC sub-services
   * - Referral generation: Missions can include referral challenges
   * 
   * @param {string} userId
   * @param {Object} userProfile - Complete user profile with all required fields
   * @returns {Promise<Array>} Array of generated mission objects
   */
  async generateMissionsForUser(userId, userProfile) {
    try {
      // Validate profile completion
      const profileJson = userProfile?.profile_json || {};
      const requiredFields = ['name', 'age', 'gender', 'nationality', 'insurance_preferences'];
      
      for (const field of requiredFields) {
        if (field === 'insurance_preferences') {
          if (!Array.isArray(profileJson[field]) || profileJson[field].length === 0) {
            throw new Error(`Profile incomplete: ${field} is required and must contain at least one preference`);
          }
        } else if (!profileJson[field]) {
          throw new Error(`Profile incomplete: ${field} is required`);
        }
      }

      if (this.isMockMode) {
        return this._generateMockMissionsForUser(userProfile);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this._buildMissionGenerationPrompt(userProfile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 1200, temperature: 0.8 });
        const parsed = this._parseMissionGenerationResponse(raw);
        return parsed || this._generateMockMissionsForUser(userProfile);
      }

      // Fallback to mock
      return this._generateMockMissionsForUser(userProfile);
    } catch (error) {
      logger.error('Error generating missions for user:', error);
      throw error;
    }
  }

  /**
   * Generate 3-step execution plan for a started mission.
   * 
   * @param {Object} mission - Mission object with details
   * @param {Object} userProfile - User profile for context
   * @returns {Promise<Array>} Array of 3 step objects: [{ step_number: 1, title: string, description: string }, ...]
   */
  async generateMissionSteps(mission, userProfile) {
    try {
      if (this.isMockMode) {
        return this._generateMockMissionSteps(mission);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this._buildMissionStepsPrompt(mission, userProfile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 600, temperature: 0.7 });
        const parsed = this._parseMissionStepsResponse(raw);
        return parsed || this._generateMockMissionSteps(mission);
      }

      return this._generateMockMissionSteps(mission);
    } catch (error) {
      logger.error('Error generating mission steps:', error);
      return this._generateMockMissionSteps(mission);
    }
  }

  // Helper methods for mission generation
  _buildMissionGenerationPrompt(userProfile) {
    const profile = userProfile?.profile_json || {};
    const insurancePrefs = profile.insurance_preferences || [];
    const areasOfInterest = profile.areas_of_interest || [];
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;
    const age = profile.age || 30;
    const gender = profile.gender || '';
    const nationality = profile.nationality || '';
    const budget = profile.budget || 0;

    return `You are an AI assistant helping QIC Life insurance super app generate personalized missions to:
1. Engage users through gamification
2. Convert single-product customers to multi-product customers
3. Increase app retention (users return more than once every few months)
4. Utilize QIC ecosystem sub-services
5. Generate referrals through loyalty and engagement

User Profile:
- Age: ${age}, Gender: ${gender}, Nationality: ${nationality}
- Insurance Preferences: ${insurancePrefs.join(', ')}
- Areas of Interest: ${areasOfInterest.join(', ')}
- Vulnerabilities: ${vulnerabilities.join(', ')}
- Budget: ${budget} QAR/year
- First-time buyer: ${firstTimeBuyer ? 'Yes' : 'No'}

Generate 3-5 personalized missions tailored to this user. Each mission must:
- Have a category matching one of: safe_driving, health, financial_guardian, family_protection, lifestyle
- Have difficulty: easy, medium, or hard
- Include coin_reward: easy=10, medium=20, hard=30
- Include xp_reward (50-200 range based on difficulty)
- Include lifescore_impact (5-20 range)
- Be directly relevant to their insurance preferences, interests, vulnerabilities, and demographics
- Promote QIC insurance products or ecosystem services
- Encourage retention and engagement

Return JSON array of missions, each with: title_en, title_ar (Arabic translation), description_en, description_ar, category, difficulty, xp_reward, lifescore_impact, coin_reward.`;
  }

  _buildMissionStepsPrompt(mission, userProfile) {
    const profile = userProfile?.profile_json || {};
    
    return `Generate exactly 3 actionable steps for this insurance mission:
Mission: ${mission.title_en || mission.title}
Category: ${mission.category}
Difficulty: ${mission.difficulty}

User context:
- Age: ${profile.age || 30}, ${profile.gender || ''}, ${profile.nationality || ''}
- Insurance preferences: ${(profile.insurance_preferences || []).join(', ')}
- First-time buyer: ${profile.first_time_buyer ? 'Yes' : 'No'}

Each step must be:
1. Actionable and specific (user can complete it)
2. Relevant to the mission category and insurance context
3. Aligned with gamification and retention goals
4. Progressive (steps build on each other)

Return JSON array with exactly 3 objects, each with: step_number (1-3), title, description.`;
  }

  _parseMissionGenerationResponse(content) {
    try {
      const parsed = JSON.parse(content || '[]');
      if (!Array.isArray(parsed)) return null;
      
      // Validate and normalize missions
      return parsed.map((m, idx) => ({
        id: m.id || `ai-gen-${Date.now()}-${idx}`,
        title_en: m.title_en || m.title || 'Mission',
        title_ar: m.title_ar || m.title || 'مهمة',
        description_en: m.description_en || m.description || 'Complete this mission',
        description_ar: m.description_ar || m.description || 'أكمل هذه المهمة',
        category: m.category || 'health',
        difficulty: m.difficulty || 'easy',
        xp_reward: m.xp_reward || 50,
        lifescore_impact: m.lifescore_impact || 5,
        coin_reward: m.coin_reward || (m.difficulty === 'easy' ? 10 : m.difficulty === 'medium' ? 20 : 30),
        ai_generated: true,
        is_active: true
      }));
    } catch {
      return null;
    }
  }

  _parseMissionStepsResponse(content) {
    try {
      const parsed = JSON.parse(content || '[]');
      if (!Array.isArray(parsed) || parsed.length !== 3) return null;
      
      return parsed.map((step, idx) => ({
        step_number: step.step_number || (idx + 1),
        title: step.title || `Step ${idx + 1}`,
        description: step.description || 'Complete this step'
      })).slice(0, 3);
    } catch {
      return null;
    }
  }

  /**
   * Generate daily brief: 1-sentence personalized hook (bilingual Arabic/English)
   * Uses optimized OpenAI prompt for cost efficiency
   * @param {string} userId
   * @param {Object} userProfile - Complete user profile
   * @returns {Promise<string>} Daily brief text
   */
  async generateDailyBrief(userId, userProfile) {
    try {
      const profile = userProfile?.profile_json || {};
      const name = profile.name || 'Friend';
      const age = profile.age || 30;
      const gender = profile.gender || '';
      const nationality = profile.nationality || '';
      const budget = profile.budget || 0;
      const insurancePrefs = profile.insurance_preferences || [];

      if (this.isMockMode) {
        return this._generateMockDailyBrief(profile);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this._buildDailyBriefPrompt(profile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 100, temperature: 0.8 });
        const parsed = this._parseDailyBriefResponse(raw);
        return parsed || this._generateMockDailyBrief(profile);
      }

      return this._generateMockDailyBrief(profile);
    } catch (error) {
      logger.error('Error generating daily brief:', error);
      return this._generateMockDailyBrief(userProfile?.profile_json || {});
    }
  }

  /**
   * Generate 3 adaptive missions (Easy/Medium/Hard) for daily reset
   * Uses optimized OpenAI prompt for cost efficiency
   * @param {string} userId
   * @param {Object} userProfile - Complete user profile
   * @returns {Promise<Array>} Array of exactly 3 missions
   */
  async generateAdaptiveMissions(userId, userProfile) {
    try {
      const profile = userProfile?.profile_json || {};
      
      if (this.isMockMode) {
        return this._generateMockAdaptiveMissions(profile);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this._buildAdaptiveMissionsPrompt(profile);
        // Use gpt-4o-mini for cost efficiency
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 800, temperature: 0.8 });
        const parsed = this._parseAdaptiveMissionsResponse(raw);
        return parsed || this._generateMockAdaptiveMissions(profile);
      }

      return this._generateMockAdaptiveMissions(profile);
    } catch (error) {
      logger.error('Error generating adaptive missions:', error);
      return this._generateMockAdaptiveMissions(userProfile?.profile_json || {});
    }
  }

  _buildDailyBriefPrompt(profile) {
    const name = profile.name || 'Friend';
    const age = profile.age || 30;
    const gender = profile.gender || '';
    const nationality = profile.nationality || '';
    const budget = profile.budget || 0;
    const insurancePrefs = profile.insurance_preferences || [];
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;

    return `You are QIC AI, a warm Qatari insurance guide focused on safety, family, and growth. Use ${name}, ${age}, ${gender}, ${nationality}, ${budget} to personalize.

Generate full Missions Tab content as JSON:

{
  "daily_brief": "1-sentence hook (12 words max, bilingual Arabic/English, include falcon/date palm motif, tie to vehicle/family safety)",
  "missions": [
    {
      "level": "easy",
      "title": "Short title (5 words)",
      "desc": "1-line desc (15 words, with QIC service CTA, cultural slang like 'majlis-safe')",
      "reward": "X QIC Coins + badge/motif"
    },
    { "level": "medium", ... },
    { "level": "hard", ... }
  ]
}

Tone: Hospitable, trusting. Output ONLY JSON. No extras.`;
  }

  _buildAdaptiveMissionsPrompt(profile) {
    const name = profile.name || 'Friend';
    const age = profile.age || 30;
    const gender = profile.gender || '';
    const nationality = profile.nationality || '';
    const budget = profile.budget || 0;
    const insurancePrefs = profile.insurance_preferences || [];
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;

    return `You are QIC AI, a warm Qatari insurance guide focused on safety, family, and growth. Use ${name}, ${age}, ${gender}, ${nationality}, ${budget} to personalize.

Generate exactly 3 tiered missions:

Easy (no policy requirement): ~50 coins + falcon badge - e.g., "Renew car liability in 2 mins"
Medium (1 policy requirement): ~150 coins + date palm animation - e.g., "Add home insurance for Eid gatherings"
Hard (2+ policies): ~300 coins + family hospitality leaderboard spot - e.g., "Refer a relative for travel cover"

Include cultural hooks (GCC hospitality, bilingual Arabic/English, Qatari motifs).
Tie to vehicle/family safety and QIC trust.

Return JSON:
{
  "daily_brief": "1-sentence hook (bilingual, 12 words max, falcon/date palm motif)",
  "missions": [
    {
      "level": "easy",
      "title_en": "Short title",
      "title_ar": "عنوان عربي",
      "desc_en": "Description with QIC CTA",
      "desc_ar": "وصف بالعربية",
      "coin_reward": 50,
      "xp_reward": 100,
      "badge": "falcon"
    },
    { "level": "medium", "coin_reward": 150, "xp_reward": 150, "badge": "date_palm" },
    { "level": "hard", "coin_reward": 300, "xp_reward": 200, "badge": "family" }
  ]
}

Output ONLY JSON.`;
  }

  _parseDailyBriefResponse(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (parsed && parsed.daily_brief) {
        return parsed.daily_brief;
      }
      // Try extracting from missions object
      if (parsed && parsed.missions && Array.isArray(parsed.missions)) {
        return parsed.daily_brief || 'Welcome back! Ready for today\'s missions?';
      }
      return null;
    } catch {
      // If not JSON, try extracting first sentence
      if (typeof content === 'string' && content.trim()) {
        return content.trim().split('\n')[0].substring(0, 150);
      }
      return null;
    }
  }

  _parseAdaptiveMissionsResponse(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (!parsed || !parsed.missions || !Array.isArray(parsed.missions)) {
        return null;
      }

      // Ensure exactly 3 missions with proper structure
      return parsed.missions.slice(0, 3).map((m, idx) => ({
        id: m.id || `daily-adaptive-${Date.now()}-${idx}`,
        title_en: m.title_en || m.title || `Daily Mission ${idx + 1}`,
        title_ar: m.title_ar || m.title || `مهمة يومية ${idx + 1}`,
        description_en: m.desc_en || m.description_en || m.description || 'Complete this mission',
        description_ar: m.desc_ar || m.description_ar || m.description || 'أكمل هذه المهمة',
        category: m.category || (m.level === 'easy' ? 'safe_driving' : m.level === 'medium' ? 'family_protection' : 'lifestyle'),
        difficulty: m.level || (idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard'),
        xp_reward: m.xp_reward || (m.level === 'easy' ? 100 : m.level === 'medium' ? 150 : 200),
        lifescore_impact: m.lifescore_impact || (m.level === 'easy' ? 5 : m.level === 'medium' ? 10 : 15),
        coin_reward: m.coin_reward || (m.level === 'easy' ? 50 : m.level === 'medium' ? 150 : 300),
        badge: m.badge || (m.level === 'easy' ? 'falcon' : m.level === 'medium' ? 'date_palm' : 'family'),
        ai_generated: true,
        is_active: true,
        recurrence_type: 'daily'
      }));
    } catch (error) {
      logger.warn('Failed to parse adaptive missions response', { error: error.message });
      return null;
    }
  }

  _generateMockDailyBrief(profile) {
    const name = profile.name || 'Friend';
    const prefs = profile.insurance_preferences || [];
    const hasCar = prefs.some(p => p.toLowerCase().includes('car'));
    
    if (hasCar) {
      return `Marhaba ${name}! Ready to secure your journey? 🦅 Your vehicle deserves the best protection.`;
    }
    return `Marhaba ${name}! Welcome back to QIC Life. 🌴 Let's build your safety net together.`;
  }

  _generateMockAdaptiveMissions(profile) {
    const prefs = profile.insurance_preferences || [];
    const hasCar = prefs.some(p => p.toLowerCase().includes('car'));
    const firstTimeBuyer = profile.first_time_buyer || false;

    return [
      {
        id: `daily-easy-${Date.now()}`,
        title_en: firstTimeBuyer ? 'Get Your First Car Insurance - 3 Months FREE' : 'Renew Car Liability in 2 Mins',
        title_ar: firstTimeBuyer ? 'احصل على أول تأمين سيارات - 3 أشهر مجاناً' : 'تجديد مسؤولية السيارة في دقيقتين',
        description_en: firstTimeBuyer ? 'Complete your first car insurance purchase and get 3 months FREE coverage!' : 'Quick renewal → 50 QIC Coins + falcon badge 🦅',
        description_ar: firstTimeBuyer ? 'أكمل أول شراء تأمين سيارات واحصل على 3 أشهر مجاناً!' : 'تجديد سريع → 50 عملة + شارة صقر 🦅',
        category: 'safe_driving',
        difficulty: 'easy',
        xp_reward: 100,
        lifescore_impact: 15,
        coin_reward: 50,
        badge: 'falcon',
        ai_generated: true,
        is_active: true,
        recurrence_type: 'daily'
      },
      {
        id: `daily-medium-${Date.now()}`,
        title_en: 'Add Home Insurance for Eid Gatherings',
        title_ar: 'أضف تأمين المنزل لمجمعات العيد',
        description_en: 'Protect your majlis → 150 Coins + date palm growth 🌴',
        description_ar: 'احمِ المجلس → 150 عملة + نمو نخلة 🌴',
        category: 'family_protection',
        difficulty: 'medium',
        xp_reward: 150,
        lifescore_impact: 10,
        coin_reward: 150,
        badge: 'date_palm',
        ai_generated: true,
        is_active: true,
        recurrence_type: 'daily'
      },
      {
        id: `daily-hard-${Date.now()}`,
        title_en: 'Refer Relative for Travel Cover',
        title_ar: 'أحِط قريباً لتأمين السفر',
        description_en: 'Share QIC with family → 300 Coins + hospitality leaderboard spot 👨‍👩‍👧‍👦',
        description_ar: 'شارك QIC مع العائلة → 300 عملة + مكان في لوحة الضيافة 👨‍👩‍👧‍👦',
        category: 'lifestyle',
        difficulty: 'hard',
        xp_reward: 200,
        lifescore_impact: 20,
        coin_reward: 300,
        badge: 'family',
        ai_generated: true,
        is_active: true,
        recurrence_type: 'daily'
      }
    ];
  }

  /**
   * Generate Road-Trip Roulette content: wheel spin, 48-hour itinerary, CTAs, rewards
   * Uses optimized OpenAI prompt for cost efficiency
   * @param {string} userId
   * @param {Object} userProfile - Complete user profile
   * @returns {Promise<Object>} Roulette result with itinerary, CTAs, rewards
   */
  async generateRoadTripRoulette(userId, userProfile) {
    try {
      const profile = userProfile?.profile_json || {};
      
      if (this.isMockMode) {
        return this._generateMockRoadTripRoulette(profile);
      }

      if (this.provider === 'openai' && this.openai) {
        const prompt = this._buildRoadTripRoulettePrompt(profile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 500, temperature: 0.8 });
        const parsed = this._parseRoadTripRouletteResponse(raw);
        return parsed || this._generateMockRoadTripRoulette(profile);
      }

      return this._generateMockRoadTripRoulette(profile);
    } catch (error) {
      logger.error('Error generating road trip roulette:', error);
      return this._generateMockRoadTripRoulette(userProfile?.profile_json || {});
    }
  }

  _buildRoadTripRoulettePrompt(profile) {
    const name = profile.name || 'Friend';
    const age = profile.age || 30;
    const gender = profile.gender || '';
    const nationality = profile.nationality || '';
    const budget = profile.budget || 0;
    const insurancePrefs = profile.insurance_preferences || [];

    return `You are QIC AI, expert in safe GCC adventures. Personalize with ${name}, ${age}, ${gender}, ${nationality}, ${budget}.

Generate full Road-Trip Roulette content as JSON for one spin:

{
  "wheel_spin_result": "Falcon wheel outcome (e.g., 'Doha Desert Dash')",
  "itinerary": [
    "Step 1: 10-word detail (local spot like Souq Waqif, tie to insurance/roadside)",
    "Step 2: ... (48-hr total, 3-5 steps)",
    "Step 3: ..."
  ],
  "ctas": [
    "One-tap action 1: 'Book roadside → 100 Coins'",
    "Action 2: 'Add travel cover → Multi-product badge'"
  ],
  "reward": "X QIC Coins + cultural proverb (Arabic/English)"
}

Focus: Vehicle safety, family fun. Output ONLY JSON. Max 100 words total.`;
  }

  _parseRoadTripRouletteResponse(content) {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (!parsed || !parsed.wheel_spin_result) {
        return null;
      }

      return {
        wheel_spin_result: parsed.wheel_spin_result || 'Doha Adventure',
        itinerary: Array.isArray(parsed.itinerary) ? parsed.itinerary.slice(0, 5) : [],
        ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
        reward: parsed.reward || '50 QIC Coins + "Travel safely, return joyfully"',
        coins_earned: parsed.coins_earned || 100,
        xp_earned: parsed.xp_earned || 50
      };
    } catch (error) {
      logger.warn('Failed to parse road trip roulette response', { error: error.message });
      return null;
    }
  }

  _generateMockRoadTripRoulette(profile) {
    const prefs = profile.insurance_preferences || [];
    const hasCar = prefs.some(p => p.toLowerCase().includes('car'));
    
    const spinResults = [
      'Doha Desert Dash 🦅',
      'Souq Waqif Wander 🌴',
      'Al Zubarah Heritage Trip 👨‍👩‍👧‍👦',
      'Katara Cultural Journey 🕌',
      'Corniche Coastal Cruise 🚗'
    ];
    
    const randomSpin = spinResults[Math.floor(Math.random() * spinResults.length)];
    
    return {
      wheel_spin_result: randomSpin,
      itinerary: [
        hasCar ? 'Fuel up at Al Sadd station → Check tire pressure and comprehensive insurance coverage' : 'Start at Souq Waqif → Explore traditional Qatari crafts and culture',
        'Visit Katara Cultural Village → Family photo opportunity at iconic amphitheater',
        'Lunch at The Pearl-Qatar → Waterfront dining with family-friendly options',
        'Return journey planning → Ensure travel insurance covers family members',
        'Arrive home safely → Review QIC multi-product bundle for next adventure'
      ],
      ctas: [
        'Book Roadside Assistance → 100 Coins',
        'Add Travel Cover → Multi-product badge + 150 Coins',
        'Share Trip with Family → Referral rewards'
      ],
      reward: '100 QIC Coins + "Travel safely, return joyfully - سافر بأمان، عُد بفرح"',
      coins_earned: 100,
      xp_earned: 50
    };
  }

  _generateMockMissionsForUser(userProfile) {
    const profile = userProfile?.profile_json || {};
    const insurancePrefs = profile.insurance_preferences || [];
    const areasOfInterest = profile.areas_of_interest || [];
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;
    const age = profile.age || 30;
    const gender = profile.gender || '';

    const missions = [];

    // Generate missions based on insurance preferences
    if (insurancePrefs.includes('car') || insurancePrefs.includes('motorcycle')) {
      missions.push({
        id: `ai-${Date.now()}-car`,
        title_en: firstTimeBuyer ? 'Get Your First Car Insurance - 3 Months FREE' : 'Safe Driving Challenge',
        title_ar: firstTimeBuyer ? 'احصل على تأمينك الأول - 3 أشهر مجانًا' : 'تحدي القيادة الآمنة',
        description_en: firstTimeBuyer 
          ? 'Complete your first car insurance purchase and get 3 months FREE coverage as a first-time buyer!'
          : 'Maintain safe driving habits for 7 consecutive days. Track your trips and avoid risky behaviors.',
        description_ar: firstTimeBuyer
          ? 'أكمل عملية شراء تأمين السيارات الأولى واحصل على 3 أشهر مجانًا كمشتري لأول مرة!'
          : 'حافظ على عادات القيادة الآمنة لمدة 7 أيام متتالية. تتبع رحلاتك وتجنب السلوكيات الخطرة.',
        category: 'safe_driving',
        difficulty: firstTimeBuyer ? 'easy' : 'medium',
        xp_reward: firstTimeBuyer ? 100 : 120,
        lifescore_impact: firstTimeBuyer ? 15 : 12,
        coin_reward: firstTimeBuyer ? 10 : 20,
        ai_generated: true,
        is_active: true
      });
    }

    if (insurancePrefs.includes('health') || (age >= 50 && gender === 'female')) {
      missions.push({
        id: `ai-${Date.now()}-health`,
        title_en: 'Health Check Mission',
        title_ar: 'مهمة الفحص الصحي',
        description_en: 'Schedule and complete a preventive health checkup. Upload results to earn rewards.',
        description_ar: 'قم بجدولة وإكمال فحص صحي وقائي. ارفع النتائج لكسب المكافآت.',
        category: 'health',
        difficulty: age >= 50 ? 'easy' : 'medium',
        xp_reward: age >= 50 ? 80 : 100,
        lifescore_impact: age >= 50 ? 12 : 10,
        coin_reward: age >= 50 ? 10 : 20,
        ai_generated: true,
        is_active: true
      });
    }

    if (insurancePrefs.includes('home') || vulnerabilities.some(v => v.toLowerCase().includes('electronics'))) {
      missions.push({
        id: `ai-${Date.now()}-home`,
        title_en: 'Home Protection Review',
        title_ar: 'مراجعة حماية المنزل',
        description_en: 'Review your home insurance coverage and identify gaps. Get personalized recommendations.',
        description_ar: 'راجع تغطية تأمين منزلك وحدد الفجوات. احصل على توصيات مخصصة.',
        category: 'family_protection',
        difficulty: 'medium',
        xp_reward: 90,
        lifescore_impact: 8,
        coin_reward: 20,
        ai_generated: true,
        is_active: true
      });
    }

    if (areasOfInterest.includes('travel') || vulnerabilities.some(v => v.toLowerCase().includes('travel'))) {
      missions.push({
        id: `ai-${Date.now()}-travel`,
        title_en: 'Travel Insurance Explorer',
        title_ar: 'مستكشف تأمين السفر',
        description_en: 'Explore travel insurance options for your next trip. Compare plans and find the best coverage.',
        description_ar: 'استكشف خيارات تأمين السفر لرحلتك القادمة. قارن الخطط وابحث عن أفضل تغطية.',
        category: 'lifestyle',
        difficulty: 'easy',
        xp_reward: 60,
        lifescore_impact: 6,
        coin_reward: 10,
        ai_generated: true,
        is_active: true
      });
    }

    // Default mission if none generated
    if (missions.length === 0) {
      missions.push({
        id: `ai-${Date.now()}-default`,
        title_en: 'Complete Your Profile',
        title_ar: 'أكمل ملفك الشخصي',
        description_en: 'Add more details to your profile to unlock personalized missions.',
        description_ar: 'أضف المزيد من التفاصيل إلى ملفك الشخصي لفتح المهام المخصصة.',
        category: 'lifestyle',
        difficulty: 'easy',
        xp_reward: 40,
        lifescore_impact: 5,
        coin_reward: 10,
        ai_generated: true,
        is_active: true
      });
    }

    return missions.slice(0, 5); // Limit to 5 missions
  }

  _generateMockMissionSteps(mission) {
    const category = mission.category || 'health';
    const difficulty = mission.difficulty || 'easy';

    // Category-specific step templates
    const templates = {
      safe_driving: [
        { step_number: 1, title: 'Review Current Coverage', description: 'Log into your QIC account and review your current car insurance policy details and coverage limits.' },
        { step_number: 2, title: 'Safe Driving Practice', description: 'Practice safe driving for 3 consecutive days: maintain speed limits, use seatbelt always, avoid distractions.' },
        { step_number: 3, title: 'Complete Safety Assessment', description: 'Complete the QIC Safe Driving Assessment quiz and review personalized recommendations.' }
      ],
      health: [
        { step_number: 1, title: 'Schedule Health Checkup', description: 'Use QIC Health Portal to schedule your preventive health checkup appointment.' },
        { step_number: 2, title: 'Attend Appointment', description: 'Attend your scheduled health checkup and collect any test results or reports.' },
        { step_number: 3, title: 'Upload Results', description: 'Upload your health checkup results to the QIC Health Portal to complete the mission and earn rewards.' }
      ],
      family_protection: [
        { step_number: 1, title: 'Review Family Coverage', description: 'Review your current family insurance coverage and identify any gaps in protection.' },
        { step_number: 2, title: 'Get Recommendations', description: 'Use the QIC Family Protection tool to get personalized coverage recommendations for your family members.' },
        { step_number: 3, title: 'Update Policy', description: 'Contact QIC to update your policy or add additional coverage based on recommendations.' }
      ],
      financial_guardian: [
        { step_number: 1, title: 'Financial Assessment', description: 'Complete the QIC Financial Health Assessment to understand your current financial protection level.' },
        { step_number: 2, title: 'Review Life Insurance', description: 'Review your life insurance coverage and calculate if it meets your family\'s future needs.' },
        { step_number: 3, title: 'Plan Improvement', description: 'Create a plan to improve your financial protection, whether through policy updates or additional coverage.' }
      ],
      lifestyle: [
        { step_number: 1, title: 'Explore Options', description: 'Browse QIC insurance products and services relevant to your interests and lifestyle.' },
        { step_number: 2, title: 'Compare Plans', description: 'Compare at least 2 different insurance plans that match your needs and budget.' },
        { step_number: 3, title: 'Take Action', description: 'Complete an action: either get a quote, schedule a consultation, or enroll in a new insurance product.' }
      ]
    };

    return templates[category] || templates.health;
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
    const qicTerms = scenarioInputs.qicTerms || {};
    const category = scenarioInputs.type || scenarioInputs.category || '';
    const scenarioText = scenarioInputs.scenario || scenarioInputs.text || '';
    const userProfile = scenarioInputs.user_profile || {};
    
    const qicContext = qicTerms.products?.[category] ? `
QIC Terms & Conditions for ${category}:
- Eligibility: ${JSON.stringify(qicTerms.products[category].eligibility || {})}
- Discounts: ${JSON.stringify(qicTerms.products[category].discounts || {})}
- Qatar-specific rules: ${JSON.stringify(qicTerms.products[category].qatar_specific_rules || [])}
- Profile factors: ${JSON.stringify(qicTerms.products[category].profile_factors || {})}
` : '';

    const profileContext = userProfile ? `
User Profile:
- Nationality: ${userProfile.nationality || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Gender: ${userProfile.gender || 'Not specified'}
- Budget: ${userProfile.budget || 'Not specified'} QAR
- First-time buyer: ${userProfile.first_time_buyer ? 'Yes' : 'No'}
- Vulnerabilities: ${JSON.stringify(userProfile.vulnerabilities || [])}
- Insurance preferences: ${JSON.stringify(userProfile.insurance_preferences || [])}
` : '';

    return `You are an AI insurance advisor for QIC (Qatar Insurance Company) in Qatar. Analyze the following scenario and recommend insurance plans.

${qicContext}

${profileContext}

Scenario:
Category: ${category}
Description: ${scenarioText}

IMPORTANT REQUIREMENTS:
1. ONLY recommend plans relevant to Qatar (all plans must comply with Qatari regulations and requirements)
2. For each recommended plan, provide a relevance_score (1-10) indicating how relevant it is for the user's selected category and described scenario
3. Provide an overall scenario_severity_score (1-10) indicating the urgency/severity of the scenario
4. Sort plans from MOST RELEVANT (highest relevance_score) to LEAST RELEVANT
5. Consider the user's profile (nationality, age, budget, first-time buyer status) when calculating relevance
6. Factor in QIC terms & conditions, eligibility requirements, and Qatar-specific rules

Return JSON with this exact structure:
{
  "narrative": "2-3 sentences analyzing the scenario",
  "severity_score": <number 1-10>,
  "recommended_plans": [
    {
      "plan_id": "<plan identifier>",
      "plan_name": "<plan name>",
      "plan_type": "${category}",
      "relevance_score": <number 1-10>,
      "description": "<why this plan is relevant>",
      "qatar_compliance": "<Qatar-specific benefits/rules>",
      "estimated_premium": "<range or estimate>",
      "key_features": ["<feature1>", "<feature2>"]
    }
  ],
  "suggested_missions": [
    {
      "id": "<mission_id>",
      "title": "<mission title>",
      "category": "<category>",
      "difficulty": "easy|medium|hard",
      "xp_reward": <number>,
      "lifescore_impact": <number>,
      "coin_reward": <number>
    }
  ],
  "lifescore_impact": <number -50 to 50>,
  "risk_level": "low|medium|high"
}

Ensure ALL plans are Qatar-relevant and sorted by relevance_score (highest first).`;
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
    const category = type || scenarioInputs.category || 'car';
    const userProfile = scenarioInputs.user_profile || {};
    
    // Calculate severity score for mock
    const severityScore = Math.min(10, Math.max(1, 
      (type === 'travel' || type === 'medical' ? 7 : 5) + 
      (userProfile.first_time_buyer ? 1 : 0)
    ));
    
    // Generate recommended plans with relevance scores
    const recommendedPlans = this.generateRecommendedPlansWithScores(category, { ...scenarioInputs, user_profile: userProfile }, severityScore);
    
    const basePrediction = {
      risk_level: 'medium',
      confidence: 0.75,
      recommendations: [],
      potential_outcomes: []
    };

    // Add severity_score and recommended_plans to all returns
    const enhancedPrediction = {
      ...basePrediction,
      severity_score: severityScore,
      recommended_plans: recommendedPlans,
      narrative: `Analyzing your ${category} insurance scenario. Based on your profile and QIC terms, we've identified relevant insurance options.`,
      lifescore_impact: type === 'medical' || type === 'travel' ? 8 : 5,
      xp_reward: 20,
      suggested_missions: this.buildSuggestedMissions({ category, user_profile: userProfile }, 5, 20)
    };

    switch (type) {
      case 'lifestyle_change':
        return {
          ...enhancedPrediction,
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
          ...enhancedPrediction,
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
        return enhancedPrediction;
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
