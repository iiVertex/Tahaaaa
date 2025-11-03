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
    // Check for disable flags
    const isDisabled = process.env.DISABLE_AI_API === 'true' || process.env.DISABLE_OPENAI === 'true';
    this.isMockMode = this.provider === 'local' || (this.provider === 'openai' && !this.openaiApiKey) || isDisabled;

    if (isDisabled) {
      logger.warn('AI API disabled via DISABLE_AI_API or DISABLE_OPENAI environment variable');
      this.openai = null;
    } else if (this.provider === 'openai' && this.openaiApiKey && OpenAIClient) {
      this.openai = new OpenAIClient({ apiKey: this.openaiApiKey });
    } else {
      this.openai = null;
    }
  }

  async sendOpenAiPrompt(prompt, { maxTokens, temperature, enableBrowsing = false } = {}) {
    // Check for temporary disable flag (set if credits exceeded)
    if (process.env.DISABLE_AI_API === 'true' || process.env.DISABLE_OPENAI === 'true') {
      logger.warn('AI API temporarily disabled via DISABLE_AI_API flag');
      throw new Error('AI API temporarily disabled. Please check your OpenAI credits and set DISABLE_AI_API=false when ready.');
    }
    
    if (!this.openai) return null;
    try {
      // Use chat.completions for better control (especially with browsing)
      if (this.openai.chat && this.openai.chat.completions) {
        const response = await this.openai.chat.completions.create({
          model: this.openaiModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: typeof temperature === 'number' ? temperature : this.openaiTemperature,
          max_tokens: typeof maxTokens === 'number' ? maxTokens : this.openaiMaxTokens,
          ...(enableBrowsing ? {
            tools: [{ type: 'web_browser' }],
            tool_choice: 'auto'
          } : {})
        });
        return response.choices?.[0]?.message?.content || '';
      }
      
      // Fallback to responses.create if chat.completions not available
      const response = await this.openai.responses.create({
        model: this.openaiModel,
        input: prompt,
        temperature: typeof temperature === 'number' ? temperature : this.openaiTemperature,
        max_output_tokens: typeof maxTokens === 'number' ? maxTokens : this.openaiMaxTokens,
        response_format: { type: 'text' }
      });
      return this.extractTextFromResponse(response);
    } catch (error) {
      // Check for credit/quota exceeded errors
      const errorMessage = error?.message || '';
      const errorCode = error?.code || error?.status || '';
      
      // OpenAI error codes for credit/quota issues
      const creditErrorCodes = ['insufficient_quota', 'rate_limit_exceeded', '429', '401', 'invalid_api_key'];
      const isCreditError = creditErrorCodes.some(code => 
        errorMessage.toLowerCase().includes(code.toLowerCase()) ||
        errorCode.toString().includes(code)
      );
      
      if (isCreditError) {
        logger.error('OpenAI credit/quota exceeded - temporarily disabling API', { 
          error: errorMessage,
          code: errorCode,
          suggestion: 'Set DISABLE_AI_API=true in .env to prevent further errors'
        });
        // Don't throw - let the calling code handle gracefully
        throw new Error(`OpenAI credits exceeded: ${errorMessage}. To temporarily disable, set DISABLE_AI_API=true in your .env file.`);
      }
      
      logger.error('OpenAI prompt error', { error: errorMessage, code: errorCode });
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

  // Predict scenario outcomes - ALWAYS uses real AI API when available
  async predictScenarioOutcome(scenarioInputs) {
    // Only use mock if genuinely no API available
      if (this.isMockMode) {
      logger.warn('AI API not available, using deterministic prediction');
        const userId = scenarioInputs?.user_id || 'local';
        return this.generateScenarioPrediction(userId, scenarioInputs?.inputs || {});
      }

    // ALWAYS attempt real AI API call when OpenAI is configured
    if (this.provider === 'openai' && this.openai) {
      try {
        const prompt = this.buildScenarioPrompt(scenarioInputs);
        // Enable browsing for scenario prompts to access QIC official documentation
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 800, enableBrowsing: true });
        
        if (!raw || raw.trim() === '') {
          throw new Error('Empty response from OpenAI API');
        }
        
        const parsed = this.parseJsonOrFallback(raw, null);
        if (!parsed) {
          throw new Error('Failed to parse AI response as JSON');
        }
        
        // CRITICAL: Ensure scenarios array ALWAYS exists and has content
        if (!parsed.scenarios || !Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
          logger.warn('AI response missing or empty scenarios array, generating fallback scenarios');
          // Generate fallback scenarios based on scenario input
          const scenarioText = scenarioInputs.scenario || scenarioInputs.scenario_description || scenarioInputs.text || '';
          const fallbackScenarios = [
            `${scenarioText || 'Your scenario'} - LifeScore impact: -5`,
            'Unexpected events may occur without proper coverage - LifeScore impact: -8',
            'Protection gaps can impact your financial security - LifeScore impact: -6',
            'Being uninsured in this scenario risks significant losses - LifeScore impact: -7'
          ];
          parsed.scenarios = fallbackScenarios;
        }
        
        // Ensure scenarios array has exactly 4 scenarios as requested
        if (parsed.scenarios.length < 4) {
          while (parsed.scenarios.length < 4) {
            parsed.scenarios.push(`Additional risk scenario ${parsed.scenarios.length + 1} - LifeScore impact: -${5 + parsed.scenarios.length}`);
          }
        }
        
        logger.info('Scenarios prepared for response', { count: parsed.scenarios?.length || 0 });
        return parsed;
      } catch (error) {
        logger.error('OpenAI API call failed - NOT falling back to mock', { 
          error: error?.message,
          scenarioText: scenarioInputs.scenario || scenarioInputs.scenario_description || scenarioInputs.text || 'N/A'
        });
        // Throw error instead of falling back - frontend should handle this
        throw new Error(`AI API error: ${error?.message || 'Failed to generate insights'}`);
      }
    }
    
    // Legacy HTTP provider
    try {
      const response = await axios.post(`${this.baseURL}/scenarios`, { inputs: scenarioInputs }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' } });
      return response?.data;
    } catch (error) {
      logger.error('Legacy API provider failed', error);
      throw new Error(`AI API error: ${error?.message || 'Failed to generate insights'}`);
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

      // Only use mock if genuinely no API available
      if (this.isMockMode) {
        logger.warn('AI API not available for mission generation, using fallback');
        return this._generateMockMissionsForUser(userProfile);
      }

      // ALWAYS attempt real AI API call when OpenAI is configured
      if (this.provider === 'openai' && this.openai) {
        try {
          const prompt = this._buildMissionGenerationPrompt(userProfile);
          const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 1200, temperature: 0.8 });
          
          if (!raw || raw.trim() === '') {
            throw new Error('Empty response from OpenAI API for mission generation');
          }
          
          const parsed = this._parseMissionGenerationResponse(raw);
          if (!parsed || !Array.isArray(parsed) || parsed.length !== 3) {
            throw new Error('AI response did not return exactly 3 missions');
          }
          
          return parsed;
        } catch (error) {
          logger.error('OpenAI API call failed for mission generation - NOT falling back to mock', { 
            error: error?.message
          });
          throw new Error(`AI API error: ${error?.message || 'Failed to generate missions'}`);
        }
      }
      
      // If no provider configured, throw error
      throw new Error('AI service not configured - cannot generate missions');
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
    // Only use mock if genuinely no API available
    if (this.isMockMode) {
      logger.warn('AI API not available for mission steps, using fallback');
      return this._generateMockMissionSteps(mission);
    }

    // ALWAYS attempt real AI API call when OpenAI is configured
    if (this.provider === 'openai' && this.openai) {
      try {
        const prompt = this._buildMissionStepsPrompt(mission, userProfile);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 600, temperature: 0.7 });
        
        if (!raw || raw.trim() === '') {
          throw new Error('Empty response from OpenAI API for mission steps');
        }
        
        const parsed = this._parseMissionStepsResponse(raw);
        if (!parsed || !Array.isArray(parsed) || parsed.length !== 3) {
          throw new Error('AI response did not return exactly 3 mission steps');
        }
        
        return parsed;
      } catch (error) {
        logger.error('OpenAI API call failed for mission steps - NOT falling back to mock', { 
          error: error?.message,
          missionId: mission.id || mission.title || 'N/A'
        });
        // Throw error - backend should handle this gracefully
        throw new Error(`AI API error: ${error?.message || 'Failed to generate mission steps'}`);
      }
    }
    
    // If no provider configured, throw error instead of returning mock
    throw new Error('AI service not configured - cannot generate mission steps');
  }

  // Helper methods for mission generation
  _buildMissionGenerationPrompt(userProfile) {
    const profile = userProfile?.profile_json || {};
    const userName = profile.name || '';
    const age = profile.age !== null && profile.age !== undefined ? profile.age : null;
    const gender = profile.gender || '';
    const nationality = profile.nationality || '';
    const budget = profile.budget !== null && profile.budget !== undefined ? profile.budget : null;
    const insurancePrefs = Array.isArray(profile.insurance_preferences) ? profile.insurance_preferences : [];
    const areasOfInterest = Array.isArray(profile.areas_of_interest) ? profile.areas_of_interest : [];
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;

    const personalizedGreeting = userName ? `Hi ${userName}! ` : '';
    
    const ageText = age !== null ? `Age: ${age}` : 'Age: Not specified';
    const genderText = gender ? `Gender: ${gender}` : 'Gender: Not specified';
    const nationalityText = nationality ? `Nationality: ${nationality}` : 'Nationality: Not specified';
    const budgetText = budget !== null && budget > 0 ? `Budget: ${budget} QAR/year` : 'Budget: Not specified';
    
    return `You are an AI assistant helping QIC Life insurance super app generate personalized missions to:
1. Engage users through gamification
2. Convert single-product customers to multi-product customers
3. Increase app retention (users return more than once every few months)
4. Utilize QIC ecosystem sub-services
5. Generate referrals through loyalty and engagement

${personalizedGreeting}Generate exactly 3 personalized missions (one easy, one medium, one hard) based on this user profile:

User Profile (MUST USE IN ALL MISSIONS - TAILOR EACH MISSION TO THESE SPECIFIC DETAILS):
- Name: ${userName || 'User'}
- ${ageText}, ${genderText}, ${nationalityText}
- ${budgetText}
- Insurance Preferences: ${insurancePrefs.join(', ') || 'Not specified'}
- Areas of Interest: ${areasOfInterest.join(', ') || 'Not specified'}
- Vulnerabilities: ${vulnerabilities.join(', ') || 'None identified'}
- First-time buyer: ${firstTimeBuyer ? 'Yes' : 'No'}

CRITICAL: Each mission MUST be directly tailored to this user's specific profile. For example:
- If user is ${age !== null ? age : 'young'}, create age-appropriate challenges
- If user has vulnerabilities like ${vulnerabilities.length > 0 ? vulnerabilities.join(', ') : 'financial insecurity'}, address those specific concerns
- If user is ${nationality || 'an expat'}, consider their unique insurance needs
- If budget is ${budget !== null && budget > 0 ? `limited (${budget} QAR)` : 'not specified'}, suggest cost-effective solutions

Generate exactly 3 personalized missions (one of each difficulty: easy, medium, hard) tailored to this user. Each mission must:
- Have a category matching one of: safe_driving, health, financial_guardian, family_protection, lifestyle
- Have difficulty: exactly one "easy", one "medium", one "hard" (3 missions total)
- Include coin_reward: easy=10, medium=20, hard=30
- Include xp_reward (50-200 range based on difficulty)
- Include lifescore_impact (5-20 range)
- Be directly relevant to their insurance preferences, interests, vulnerabilities, and demographics
- Promote QIC insurance products or ecosystem services
- Encourage retention and engagement

CRITICAL: Return exactly 3 missions - one easy, one medium, one hard. Do not include any difficulty selection UI - each user gets one of each difficulty automatically.

Return JSON array of exactly 3 missions, each with: title_en, title_ar (Arabic translation), description_en, description_ar, category, difficulty (must be "easy", "medium", or "hard" - one of each), xp_reward, lifescore_impact, coin_reward.`;
  }

  _buildMissionStepsPrompt(mission, userProfile) {
    const profile = userProfile?.profile_json || {};
    const userName = profile.name || '';
    const userAge = profile.age !== null && profile.age !== undefined ? profile.age : null;
    const userGender = profile.gender || '';
    const userNationality = profile.nationality || '';
    const userBudget = profile.budget !== null && profile.budget !== undefined ? profile.budget : null;
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const insurancePrefs = Array.isArray(profile.insurance_preferences) ? profile.insurance_preferences : [];
    const firstTimeBuyer = profile.first_time_buyer || false;
    
    const personalizedGreeting = userName ? `Hi ${userName}! ` : '';
    
    const ageText = userAge !== null ? `${userAge} years old` : 'not specified age';
    const genderText = userGender || 'unspecified gender';
    const nationalityText = userNationality || 'unspecified nationality';
    const budgetText = userBudget !== null && userBudget > 0 ? `${userBudget} QAR/year budget` : 'budget not specified';
    
    return `You are QIC AI, a warm QIC insurance guide. ${personalizedGreeting}Generate exactly 3 actionable steps for this insurance mission:

Mission: ${mission.title_en || mission.title}
Category: ${mission.category}
Difficulty: ${mission.difficulty}

User Profile (MUST USE IN EACH STEP - TAILOR EVERY STEP TO THESE SPECIFIC DETAILS):
- Name: ${userName || 'User'}
- ${ageText}, ${genderText}, ${nationalityText}
- ${budgetText}
- Insurance preferences: ${insurancePrefs.join(', ') || 'Not specified'}
- Vulnerabilities: ${vulnerabilities.join(', ') || 'None identified'}
- First-time buyer: ${firstTimeBuyer ? 'Yes' : 'No'}

CRITICAL REQUIREMENTS FOR STEPS:
1. Each step MUST be dynamically generated and tailored to this user's specific profile (${userName || 'user'}, ${userAge !== null ? `age ${userAge}` : 'unknown age'}, ${userNationality || 'unknown nationality'})
2. Steps should be INTERACTIVE and VARIED - mix of:
   - Button-based games (click interactions, progress bars, quick taps)
   - Task-based actions (checklist items, information gathering, planning)
   - Engagement activities (sharing progress, setting goals, reviewing stats)
3. Steps must address user's vulnerabilities: ${vulnerabilities.length > 0 ? vulnerabilities.join(', ') : 'None - focus on general engagement'}
4. Steps must be relevant to user's insurance preferences: ${insurancePrefs.join(', ') || 'None - focus on discovery'}
5. Each step must be:
   - Actionable and specific (user can complete it)
   - Relevant to the mission category and insurance context
   - Aligned with gamification and retention goals
   - Personalized using ALL user profile data (age, gender, nationality, budget, vulnerabilities)
   - Progressive (steps build on each other)

Return JSON array with exactly 3 objects, each with: step_number (1-3), title (personalized to user), description (detailed, references user's profile like name ${userName || 'User'}, age ${userAge !== null ? userAge : 'N/A'}, nationality ${userNationality || 'N/A'}, vulnerabilities ${vulnerabilities.length > 0 ? vulnerabilities.join(', ') : 'None'} where relevant).

IMPORTANT: Make each step unique, dynamic, and unpredictable. Vary the interaction types - some should be quick button interactions, others should be more involved tasks.`;
  }

  _parseMissionGenerationResponse(content) {
    try {
      const parsed = JSON.parse(content || '[]');
      if (!Array.isArray(parsed)) return null;
      
      // Validate and normalize missions
      const normalized = parsed.map((m, idx) => ({
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

      // Ensure exactly one mission of each difficulty
      const difficulties = ['easy', 'medium', 'hard'];
      const difficultyGroups = {
        easy: normalized.filter(m => m.difficulty === 'easy'),
        medium: normalized.filter(m => m.difficulty === 'medium'),
        hard: normalized.filter(m => m.difficulty === 'hard')
      };

      const finalMissions = [];
      for (const difficulty of difficulties) {
        if (difficultyGroups[difficulty].length > 0) {
          finalMissions.push(difficultyGroups[difficulty][0]);
        } else {
          // Generate default for missing difficulty
          const defaultMission = {
            id: `ai-gen-${Date.now()}-${difficulty}`,
            title_en: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Insurance Mission`,
            title_ar: `مهمة تأمين ${difficulty === 'easy' ? 'سهلة' : difficulty === 'medium' ? 'متوسطة' : 'صعبة'}`,
            description_en: `Complete this ${difficulty} mission to earn rewards.`,
            description_ar: `أكمل هذه المهمة ${difficulty === 'easy' ? 'السهلة' : difficulty === 'medium' ? 'المتوسطة' : 'الصعبة'}.`,
            category: 'lifestyle',
            difficulty: difficulty,
            xp_reward: difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 150,
            lifescore_impact: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15,
            coin_reward: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30,
            ai_generated: true,
            is_active: true
          };
          finalMissions.push(defaultMission);
        }
      }

      return finalMissions; // Exactly 3 missions (one of each difficulty)
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

      // Only use mock if genuinely no API available
      if (this.isMockMode) {
        logger.warn('AI API not available for daily brief, using fallback');
        return this._generateMockDailyBrief(profile);
      }

      // ALWAYS attempt real AI API call when OpenAI is configured
      if (this.provider === 'openai' && this.openai) {
        try {
          const prompt = this._buildDailyBriefPrompt(profile);
          const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 100, temperature: 0.8 });
          
          if (!raw || raw.trim() === '') {
            throw new Error('Empty response from OpenAI API for daily brief');
          }
          
          const parsed = this._parseDailyBriefResponse(raw);
          if (!parsed) {
            throw new Error('Failed to parse AI daily brief response');
          }
          
          return parsed;
        } catch (error) {
          logger.error('OpenAI API call failed for daily brief - NOT falling back to mock', { error: error?.message });
          throw new Error(`AI API error: ${error?.message || 'Failed to generate daily brief'}`);
        }
      }
      
      throw new Error('AI service not configured - cannot generate daily brief');
    } catch (error) {
      logger.error('Error generating daily brief:', error);
      // Re-throw instead of returning mock - caller should handle
      throw error;
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
      
      // Only use mock if genuinely no API available
      if (this.isMockMode) {
        logger.warn('AI API not available for adaptive missions, using fallback');
        return this._generateMockAdaptiveMissions(profile);
      }

      // ALWAYS attempt real AI API call when OpenAI is configured
      if (this.provider === 'openai' && this.openai) {
        try {
          const prompt = this._buildAdaptiveMissionsPrompt(profile);
          const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 800, temperature: 0.8 });
          
          if (!raw || raw.trim() === '') {
            throw new Error('Empty response from OpenAI API for adaptive missions');
          }
          
          const parsed = this._parseAdaptiveMissionsResponse(raw);
          if (!parsed || !Array.isArray(parsed) || parsed.length !== 3) {
            throw new Error('AI response did not return exactly 3 adaptive missions');
          }
          
          return parsed;
        } catch (error) {
          logger.error('OpenAI API call failed for adaptive missions - NOT falling back to mock', { error: error?.message });
          throw new Error(`AI API error: ${error?.message || 'Failed to generate adaptive missions'}`);
        }
      }
      
      throw new Error('AI service not configured - cannot generate adaptive missions');
    } catch (error) {
      logger.error('Error generating adaptive missions:', error);
      // Re-throw instead of returning mock - caller should handle
      throw error;
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
      
      // Only use mock if genuinely no API available
      if (this.isMockMode) {
        logger.warn('AI API not available for road trip roulette, using fallback');
        return this._generateMockRoadTripRoulette(profile);
      }

      // ALWAYS attempt real AI API call when OpenAI is configured
      if (this.provider === 'openai' && this.openai) {
        try {
          const prompt = this._buildRoadTripRoulettePrompt(profile);
          const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 500, temperature: 0.8 });
          
          if (!raw || raw.trim() === '') {
            throw new Error('Empty response from OpenAI API for road trip roulette');
          }
          
          const parsed = this._parseRoadTripRouletteResponse(raw);
          if (!parsed) {
            throw new Error('Failed to parse AI road trip roulette response');
          }
          
          return parsed;
        } catch (error) {
          logger.error('OpenAI API call failed for road trip roulette - NOT falling back to mock', { error: error?.message });
          throw new Error(`AI API error: ${error?.message || 'Failed to generate road trip itinerary'}`);
        }
      }
      
      throw new Error('AI service not configured - cannot generate road trip itinerary');
    } catch (error) {
      logger.error('Error generating road trip roulette:', error);
      // Re-throw instead of returning mock - caller should handle
      throw error;
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

    // Ensure we have exactly one mission of each difficulty (easy, medium, hard)
    const difficulties = ['easy', 'medium', 'hard'];
    const difficultyGroups = {
      easy: missions.filter(m => m.difficulty === 'easy'),
      medium: missions.filter(m => m.difficulty === 'medium'),
      hard: missions.filter(m => m.difficulty === 'hard')
    };

    const finalMissions = [];
    
    // Add one mission of each difficulty
    for (const difficulty of difficulties) {
      if (difficultyGroups[difficulty].length > 0) {
        finalMissions.push(difficultyGroups[difficulty][0]);
      } else {
        // Generate a default mission for missing difficulty
        const defaultMission = {
          id: `ai-${Date.now()}-${difficulty}-default`,
          title_en: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Insurance Mission`,
          title_ar: `مهمة تأمين ${difficulty === 'easy' ? 'سهلة' : difficulty === 'medium' ? 'متوسطة' : 'صعبة'}`,
          description_en: `Complete this ${difficulty} mission to earn rewards and improve your LifeScore.`,
          description_ar: `أكمل هذه المهمة ${difficulty === 'easy' ? 'السهلة' : difficulty === 'medium' ? 'المتوسطة' : 'الصعبة'} لكسب المكافآت وتحسين درجة حياتك.`,
          category: 'lifestyle',
          difficulty: difficulty,
          xp_reward: difficulty === 'easy' ? 50 : difficulty === 'medium' ? 100 : 150,
          lifescore_impact: difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 15,
          coin_reward: difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 30,
          ai_generated: true,
          is_active: true
        };
        finalMissions.push(defaultMission);
      }
    }

    return finalMissions; // Return exactly 3 missions (one of each difficulty)
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
    const scenarioText = scenarioInputs.scenario || scenarioInputs.text || scenarioInputs.scenario_description || '';
    const userProfile = scenarioInputs.user_profile || {};
    
    // Load QIC insurance plans JSON structure (new format)
    let qicPlansJson = '';
    try {
      // Import insurance plans JSON - in production this would be loaded from file or API
      const insurancePlansData = scenarioInputs.insurance_plans_json || {};
      qicPlansJson = JSON.stringify(insurancePlansData, null, 2);
    } catch (e) {
      logger.warn('Could not load insurance plans JSON for prompt', e);
    }

    const qicContext = qicTerms.products?.[category] ? `
QIC Terms & Conditions for ${category}:
- Eligibility: ${JSON.stringify(qicTerms.products[category].eligibility || {})}
- Discounts: ${JSON.stringify(qicTerms.products[category].discounts || {})}
- Qatar-specific rules: ${JSON.stringify(qicTerms.products[category].qatar_specific_rules || [])}
- Profile factors: ${JSON.stringify(qicTerms.products[category].profile_factors || {})}
` : '';

    const profileContext = userProfile ? `
User Profile:
- Name: ${userProfile.name || 'Not specified'}
- Nationality: ${userProfile.nationality || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Gender: ${userProfile.gender || 'Not specified'}
- Budget: ${userProfile.budget || 'Not specified'} QAR/year
- First-time buyer: ${userProfile.first_time_buyer ? 'Yes' : 'No'}
- Vulnerabilities: ${JSON.stringify(userProfile.vulnerabilities || [])}
- Insurance preferences: ${JSON.stringify(userProfile.insurance_preferences || [])}
` : '';

    const userName = userProfile?.name || '';
    const userAge = userProfile?.age || null;
    const userNationality = userProfile?.nationality || null;
    const userBudget = userProfile?.budget || null;
    const userVulnerabilities = Array.isArray(userProfile?.vulnerabilities) ? userProfile.vulnerabilities : [];
    const timeContext = scenarioInputs.time_context || {};
    const currentSeason = timeContext.season || '';
    const currentMonth = timeContext.month || new Date().getMonth() + 1;
    
    const personalizedGreeting = userName ? `Hi ${userName}! ` : '';
    const vulnerabilityContext = userVulnerabilities.length > 0 
      ? `\nUser's identified vulnerabilities: ${userVulnerabilities.join(', ')}. Consider these when recommending plans.`
      : '';
    const seasonContext = currentSeason ? `\nCurrent season: ${currentSeason} (month ${currentMonth}). Consider seasonal insurance needs (e.g., travel during holidays, car maintenance before summer).` : '';
    
    return `You are an AI insurance advisor for QIC (Qatar Insurance Company) in Qatar. ${personalizedGreeting}Analyze the following scenario and provide comprehensive insurance recommendations.

CRITICAL: ONLY use QIC (Qatar Insurance Company) information. Do not reference any other insurance provider.

${qicContext}

${profileContext}
${vulnerabilityContext}
${seasonContext}

${qicPlansJson ? `\nAvailable QIC Insurance Plans (from official QIC documentation):\n${qicPlansJson}\n` : ''}

USER'S SCENARIO (THIS IS THE PRIMARY INPUT - MUST BE REFERENCED DIRECTLY):
"${scenarioText}"

Category: ${category}

CRITICAL: Your recommendations MUST be directly relevant to this EXACT scenario the user entered. Reference specific details from their scenario in your analysis.

IMPORTANT REQUIREMENTS:
1. Generate exactly 4 general scenarios the user might encounter based on their entered scenario (one sentence each, max 20 words per scenario)
   - Scenarios must be heavily attuned to context (user's EXACT scenario + profile + time of year)
   - Each scenario should highlight a different risk/situation derived from the user's entered scenario
   - Scenarios must be realistic and relevant to Qatar context
   - Each scenario MUST include LifeScore impact at the end: " - LifeScore impact: -{X}" where X is 1-15 based on severity
   - Example format: "You might get injured in a car crash due to high traffic density - LifeScore impact: -8"

2. Determine ALL relevant insurance types from the user's EXACT scenario, then match specific QIC plans from the provided JSON structure
   - Match plans by insurance_type (Car Insurance, Health Insurance, Personal Accident Insurance, Home Contents Insurance, Boat and Yacht Insurance, Business Shield Insurance, Golf Insurance)
   - Extract plan_name, standard_coverages, optional_add_ons that match the scenarios
   - Only use QIC plans - no other providers

3. For EACH recommended_plan (including best_plan), generate exactly 3 plan_scenarios:
   - Each plan_scenario must show a SPECIFIC situation where features of THIS plan would help save the user
   - Each plan_scenario must include:
     a) scenario: "One sentence description of where this plan's coverage helps (max 25 words)"
     b) feature: Which coverage item/feature applies (e.g., "Third Party Liability", "Medical Evacuation")
     c) lifescore_with_coverage: Positive impact (e.g., +5, +8) - having this coverage prevents LifeScore loss
     d) lifescore_without_coverage: Negative impact (e.g., -5, -8) - NOT having coverage causes LifeScore loss
     e) severity: 1-10 scale (higher = more severe scenario)
   - Scenarios must be tailored to the user's entered scenario: "${scenarioText}"
   - Include user profile context (name ${userProfile.name || ''}, age ${userAge}, nationality ${userNationality})
   - Make scenarios Qatar-context relevant

4. For THE ONE best plan's standard_coverages (from insurancePlans.json):
   - For EACH standard_coverages item, generate ONE specific scenario where THIS coverage is needed
   - Format: "You might [specific scenario tailored to user profile and Qatar context] so this {coverage_item} protects you..."
   - Include user profile context: name ${userProfile.name || ''}, age ${userAge}, nationality ${userNationality}, vulnerabilities: ${userProfile.vulnerabilities?.join(', ') || 'none'}
   - Include LifeScore impact (1-15) for each scenario based on severity
   - Example: "You might get into an accident on Doha Expressway during rush hour (as a ${userNationality} resident, age ${userAge}) so Third Party Liability coverage protects you from financial responsibility for damages to other vehicles - LifeScore impact: -8"
   - Each scenario must be concise (one sentence, max 25 words) and Qatar-context relevant

5. SELECT ONLY THE ONE BEST PLAN based on:
   a) Highest relevance_score (1-10 scale)
   b) If scores are equal, prioritize by Maslow's hierarchy:
      - Physiological (Health/Medical insurance) - Basic survival needs (highest priority)
      - Safety (Car/Home/Property insurance) - Security and protection
      - Social (Family protection plans/Travel) - Relationships and belonging
      - Esteem/Self-actualization (Life insurance) - Status and future planning (lowest priority)
   
6. Return ONLY ONE best_plan (not an array)
7. Factor in QIC terms & conditions, eligibility requirements, and Qatar-specific rules

Return JSON with this exact structure:
{
  "narrative": "2-3 sentences analyzing the scenario (concise)",
  "severity_score": <number 1-10>,
  "scenarios": [
    "Scenario 1 (one sentence, max 20 words) - LifeScore impact: -{X}",
    "Scenario 2 (one sentence, max 20 words) - LifeScore impact: -{X}",
    "Scenario 3 (one sentence, max 20 words) - LifeScore impact: -{X}",
    "Scenario 4 (one sentence, max 20 words) - LifeScore impact: -{X}"
  ],
  "best_plan": {
    "plan_id": "<unique identifier>",
    "plan_name": "<plan name from QIC JSON - MUST match exactly to insurancePlans.json>",
    "insurance_type": "<Car Insurance|Health Insurance|Personal Accident Insurance|etc>",
    "relevance_score": <number 1-10>,
    "scenario_logic": "You might {scenario} so {plan_name} covers you with {key_coverages} AND based on your profile info you qualify for {discount}",
    "description": "<why this plan is relevant to the user's EXACT scenario>",
    "qatar_compliance": "<Qatar-specific benefits/rules>",
    "estimated_premium": "<QAR range or estimate>",
    "key_features": ["<feature1>", "<feature2>"],
    "standard_coverages": [{"item": "...", "limit": "...", "description": "..."}],
    "profile_discount": "As a {profile_trait}, you qualify for {discount}",
    "coverage_scenarios": [
      {
        "coverage_item": "<exact name from standard_coverages item>",
        "scenario": "You might [specific scenario tailored to user] so this coverage protects you...",
        "lifescore_impact": <number 1-15>
      }
    ],
    "plan_scenarios": [
      {
        "scenario": "One sentence where this plan helps (tailored to user's entered scenario)",
        "feature": "Which coverage item applies",
        "lifescore_with_coverage": <positive number 1-15>,
        "lifescore_without_coverage": <negative number -1 to -15>,
        "severity": <number 1-10>
      },
      {
        "scenario": "Second scenario",
        "feature": "Another coverage item",
        "lifescore_with_coverage": <positive number>,
        "lifescore_without_coverage": <negative number>,
        "severity": <number 1-10>
      },
      {
        "scenario": "Third scenario",
        "feature": "Third coverage item",
        "lifescore_with_coverage": <positive number>,
        "lifescore_without_coverage": <negative number>,
        "severity": <number 1-10>
      }
    ]
  },
  "recommended_plans": [
    {
      "plan_id": "<unique identifier>",
      "plan_name": "<plan name>",
      "insurance_type": "<Car Insurance|Health Insurance|etc>",
      "relevance_score": <number 1-10>,
      "description": "<why this plan is relevant>",
      "plan_scenarios": [
        {"scenario": "...", "feature": "...", "lifescore_with_coverage": <number>, "lifescore_without_coverage": <number>, "severity": <number>},
        {"scenario": "...", "feature": "...", "lifescore_with_coverage": <number>, "lifescore_without_coverage": <number>, "severity": <number>},
        {"scenario": "...", "feature": "...", "lifescore_with_coverage": <number>, "lifescore_without_coverage": <number>, "severity": <number>}
      ]
    }
  ],
  "profile_discounts": [
    {
      "type": "first_time_buyer" | "age_based" | "nationality_based",
      "discount": "10% off" | "special deal",
      "qualification": "As a first-time buyer..." 
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

Ensure ALL responses are concise and instantly summarizable. ALL plans must be from QIC only.`;
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
    // Extract scenario text properly
    const scenarioText = scenarioInputs.scenario || scenarioInputs.scenario_description || scenarioInputs.text || '';
    
    // Calculate severity score for mock
    const severityScore = Math.min(10, Math.max(1, 
      (type === 'travel' || type === 'medical' ? 7 : 5) + 
      (userProfile.first_time_buyer ? 1 : 0)
    ));
    
    // Generate recommended plans with relevance scores
    const recommendedPlans = this.generateRecommendedPlansWithScores(category, { ...scenarioInputs, user_profile: userProfile }, severityScore);
    
    // Generate 4 scenarios based on actual scenario text (not just category)
    const mockScenarios = [];
    const lcText = scenarioText.toLowerCase();
    if (category === 'travel' || lcText.includes('trip') || lcText.includes('umrah') || lcText.includes('travel') || lcText.includes('vacation')) {
      mockScenarios.push(
        'You might face a medical emergency requiring hospitalization during your trip.',
        'Your baggage could be lost or damaged during transit.',
        'Flight delays or cancellations might disrupt your travel plans.',
        'You could require emergency evacuation or repatriation due to unforeseen circumstances.'
      );
    } else if (category === 'car' || scenarioText?.toLowerCase().includes('car') || scenarioText?.toLowerCase().includes('drive')) {
      mockScenarios.push(
        'You might get injured in a car crash due to high traffic density.',
        'Your vehicle could sustain damage from accidents or natural disasters.',
        'Third-party property damage claims might arise from collisions.',
        'Roadside breakdowns could leave you stranded without assistance.'
      );
    } else {
      mockScenarios.push(
        'You might encounter unexpected risks requiring insurance protection.',
        'Financial losses could occur from uninsured incidents.',
        'Legal liabilities might arise from uncovered situations.',
        'Emergency situations could require immediate coverage support.'
      );
    }
    
    const basePrediction = {
      risk_level: 'medium',
      confidence: 0.75,
      recommendations: [],
      potential_outcomes: []
    };

    // Add severity_score, scenarios, and recommended_plans to all returns
    const enhancedPrediction = {
      ...basePrediction,
      severity_score: severityScore,
      scenarios: mockScenarios,
      recommended_plans: recommendedPlans.map(p => ({
        ...p,
        scenario_logic: `You might encounter risks so ${p.plan_name} covers you with ${p.key_features?.slice(0, 3).join(', ') || 'comprehensive protection'}${userProfile.first_time_buyer ? ' AND as a first-time buyer you qualify for exclusive discounts' : ''}`,
        profile_discount: userProfile.first_time_buyer ? 'As a first-time buyer, you qualify for 10% off' : userProfile.age && userProfile.age < 25 ? 'As a young driver under 25, you qualify for special rates' : null
      })),
      narrative: `Analyzing your ${category} insurance scenario. Based on your profile and QIC terms, we've identified relevant insurance options.`,
      lifescore_impact: type === 'medical' || type === 'travel' ? 8 : 5,
      xp_reward: 20,
      suggested_missions: this.buildSuggestedMissions({ category, user_profile: userProfile }, 5, 20),
      profile_discounts: userProfile.first_time_buyer ? [
        { type: 'first_time_buyer', discount: '10% off', qualification: 'As a first-time buyer' }
      ] : []
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

  /**
   * Generate personalized plan detail content for Explore page
   * @param {Object} plan - Insurance plan object
   * @param {Object} userProfile - User profile data
   * @param {string} scenarioText - User's scenario description
   * @returns {Promise<Object>} Formatted plan detail content
   */
  async generatePlanDetailContent(plan, userProfile, scenarioText) {
    // Only use mock if genuinely no API available
    if (this.isMockMode) {
      logger.warn('AI API not available for plan detail, using template fallback');
      return this._generateMockPlanDetail(plan, userProfile, scenarioText);
    }

    // ALWAYS attempt real AI API call when OpenAI is configured
    if (this.provider === 'openai' && this.openai) {
      try {
        const prompt = this._buildPlanDetailPrompt(plan, userProfile, scenarioText);
        const raw = await this.sendOpenAiPrompt(prompt, { maxTokens: 1200, enableBrowsing: true });
        
        if (!raw || raw.trim() === '') {
          throw new Error('Empty response from OpenAI API for plan detail');
        }
        
        const parsed = this.parseJsonOrFallback(raw, () => this._generateMockPlanDetail(plan, userProfile, scenarioText));
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Failed to parse AI plan detail response');
        }
        
        logger.info('Plan detail content generated', {
          plan_name: plan.plan_name,
          hasContent: !!parsed.header
        });
        
        return parsed;
      } catch (error) {
        logger.error('OpenAI API call failed for plan detail - falling back to template', { error: error?.message });
        return this._generateMockPlanDetail(plan, userProfile, scenarioText);
      }
    }
    
    // Fallback to mock/template
    return this._generateMockPlanDetail(plan, userProfile, scenarioText);
  }

  _buildPlanDetailPrompt(plan, userProfile, scenarioText) {
    const profile = userProfile?.profile_json || userProfile || {};
    const userName = profile.name || 'User';
    const userAge = profile.age || 30;
    const userGender = profile.gender || '';
    const userNationality = profile.nationality || '';
    const userBudget = profile.budget || 0;
    const vulnerabilities = Array.isArray(profile.vulnerabilities) ? profile.vulnerabilities : [];
    const firstTimeBuyer = profile.first_time_buyer || false;

    const planName = plan.plan_name || plan.name || '';
    const insuranceType = plan.insurance_type || plan.type || '';
    const standardCoverages = plan.standard_coverages || [];
    const optionalAddOns = plan.optional_add_ons || [];
    const exclusions = plan.exclusions || [];

    return `You are QIC AI, a warm Qatari insurance advisor. Generate a comprehensive, personalized plan detail page for ${userName}.

USER'S SCENARIO: "${scenarioText || 'General insurance needs'}"

PLAN DETAILS:
- Plan Name: ${planName}
- Insurance Type: ${insuranceType}
- Standard Coverages: ${JSON.stringify(standardCoverages)}
- Optional Add-ons: ${JSON.stringify(optionalAddOns)}
- Exclusions: ${JSON.stringify(exclusions)}

USER PROFILE:
- Name: ${userName}
- Age: ${userAge}
- Gender: ${userGender}
- Nationality: ${userNationality}
- Budget: ${userBudget} QAR/year
- Vulnerabilities: ${vulnerabilities.join(', ') || 'None'}
- First-time buyer: ${firstTimeBuyer ? 'Yes' : 'No'}

CRITICAL: Generate content matching this EXACT JSON structure:

{
  "header": "${planName} - Personalized for ${userName} (${userAge}, ${userGender || 'N/A'}${userNationality ? ', ' + userNationality : ''}${scenarioText ? ', ' + scenarioText.substring(0, 50) : ''}${userBudget > 0 ? ', Budget ' + userBudget + ' QAR/year' : ''})",
  "welcomeMessage": "2-3 sentences personalized greeting mentioning ${userName}'s age (${userAge}), scenario (${scenarioText}), and why ${planName} is perfect for them. Be warm, Qatari-context aware, and encouraging.",
  "whyItFits": [
    ${[
      userGender ? `"Age & Gender Relevance: At ${userAge} and ${userGender}, [why this plan fits age/gender]"` : `"Age Relevance: At ${userAge}, [why this plan fits your age]"`,
      scenarioText ? `"Your Plan Context: ${scenarioText.substring(0, 60)} - This policy directly addresses these needs."` : '"General relevance based on your profile."',
      userNationality ? `"${userNationality} Customer Perks: As a QIC customer, you get instant digital issuance, QAR payments, local support."` : '"QIC Customer Benefits: Instant digital issuance, QAR payments, local support."',
      userBudget > 0 ? `"Cost for You: Estimated QAR range based on your ${userBudget} QAR/year budget."` : '"Cost Estimate: Contact QIC for pricing."',
      vulnerabilities.length > 0 ? `"Your Identified Needs: ${vulnerabilities.join(', ')} - this plan addresses these."` : null,
      firstTimeBuyer ? '"First-Time Buyer Friendly: Straightforward coverage, perfect for getting started."' : null
    ].filter(Boolean).join(',\n    ')}
  ],
  "coverageTable": [
    ${standardCoverages.map((cov, idx) => {
      const item = typeof cov === 'string' ? cov : (cov.item || '');
      const limit = typeof cov === 'string' ? 'Not specified' : (cov.limit || 'Not specified');
      const desc = typeof cov === 'string' ? '' : (cov.description || '');
      const itemEscaped = item.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const limitEscaped = limit.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const descEscaped = (desc || item + ' coverage').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const scenarioContext = scenarioText ? scenarioText.substring(0, 40).replace(/"/g, '\\"') : 'their needs';
      return `{
        "coverageItem": "${itemEscaped}",
        "limit": "${limitEscaped}",
        "whatsCovered": "${descEscaped}",
        "whyItMatters": "One sentence explaining why ${itemEscaped} matters for ${userName} (age ${userAge}, ${userNationality || 'in Qatar'}) in context of ${scenarioContext}"
      }`;
    }).join(',\n    ')}
  ],
  "scenarios": [
    ${[0, 1, 2].map((idx) => {
      const coverageItem = standardCoverages[idx] ? (typeof standardCoverages[idx] === 'string' ? standardCoverages[idx] : standardCoverages[idx].item) : '';
      const coverageItemEscaped = (coverageItem || 'Coverage Protection').replace(/"/g, '\\"');
      const severity = 3 + (idx * 2);
      const lifescoreWithout = -Math.min(15, 5 + (idx * 3));
      const lifescoreWith = Math.abs(lifescoreWithout) - 2;
      const scenarioPart = scenarioText ? 'planning ' + scenarioText.substring(0, 30).replace(/"/g, '\\"') : 'in a situation';
      return `{
        "title": "Scenario ${idx + 1}: ${coverageItemEscaped} (Age-Relevant)",
        "description": "One detailed sentence: ${userName} (${userAge}, ${userGender || 'N/A'}, ${userNationality || 'Qatari'}) ${scenarioPart} where ${coverageItemEscaped} coverage would protect them. Include specific context (location, activity, risk).",
        "lifescoreWithCoverage": ${lifescoreWith},
        "lifescoreWithoutCoverage": ${lifescoreWithout},
        "netBenefit": ${lifescoreWith + Math.abs(lifescoreWithout)},
        "savings": "Savings: [amount or protection description]. Without insurance, you'd face [consequence]."
      }`;
    }).join(',\n    ')}
  ],
  "exclusions": [
    ${exclusions.map((exc) => {
      const desc = typeof exc === 'string' ? exc : (exc.description || exc.item || '');
      return `"${desc.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }).join(',\n    ')}
  ],
  "nextSteps": [
    {
      "step": 1,
      "title": "Get Quote",
      "description": "Visit qic.online – enter your details for instant pricing.",
      "link": "https://qic.online"
    },
    {
      "step": 2,
      "title": "Buy & Download",
      "description": "Pay QAR via card; get PDF policy emailed instantly.",
      "link": "https://qic.online"
    },
    {
      "step": 3,
      "title": "${(scenarioText && scenarioText.toLowerCase().includes('visa')) ? 'Visa Ready' : 'Secure Your Coverage'}",
      "description": "${(scenarioText && scenarioText.toLowerCase().includes('visa')) ? 'Print/email the policy – embassies accept QIC format.' : 'Your coverage is active immediately upon purchase.'}"
    },
    {
      "step": 4,
      "title": "Claims?",
      "description": "24/7 hotline (8000 742) or app – file digitally for fast payouts."
    }
  ],
  "contactInfo": "${userName}, with QIC, your coverage is protected – focus on what matters, not the 'what-ifs'. Questions? Chat us at 5000 0742 or email support@qic.com.qa. Safe travels! *Policy details based on QIC's 2025 terms; limits/exclusions may vary. Always review full wording.*"
}

Ensure ALL content is:
- Personalized to ${userName}'s exact profile (age ${userAge}, ${userGender}, ${userNationality}, ${scenarioText ? `scenario: ${scenarioText}` : 'general needs'})
- Qatar-context aware
- Concise and instantly summarizable
- Referencing specific details from their scenario: "${scenarioText}"
- Using exact plan coverage details from provided data

Return ONLY the JSON object, no extra text.`;
  }

  _generateMockPlanDetail(plan, userProfile, scenarioText) {
    // Fallback template-based content
    const profile = userProfile?.profile_json || userProfile || {};
    const userName = profile.name || 'User';
    
    return {
      header: `${plan.plan_name || plan.name} - Personalized for ${userName}`,
      welcomeMessage: `This plan is designed to meet your insurance needs.`,
      whyItFits: [
        `Tailored Protection: This plan is specifically designed to match your profile and provide comprehensive coverage.`
      ],
      coverageTable: (plan.standard_coverages || []).slice(0, 5).map((cov) => ({
        coverageItem: typeof cov === 'string' ? cov : (cov.item || ''),
        limit: typeof cov === 'string' ? 'Not specified' : (cov.limit || 'Not specified'),
        whatsCovered: typeof cov === 'string' ? '' : (cov.description || ''),
        whyItMatters: `Protects you from financial losses related to this coverage.`
      })),
      scenarios: [
        {
          title: 'Scenario 1: Coverage Protection',
          description: `${userName} might encounter a situation requiring this coverage.`,
          lifescoreWithCoverage: 5,
          lifescoreWithoutCoverage: -5,
          netBenefit: 10,
          savings: 'Savings: Protected amount'
        }
      ],
      exclusions: (plan.exclusions || []).map((exc) => typeof exc === 'string' ? exc : (exc.description || '')),
      nextSteps: [
        {
          step: 1,
          title: 'Get Quote',
          description: 'Visit qic.online for instant pricing.',
          link: 'https://qic.online'
        }
      ],
      contactInfo: `${userName}, with QIC, your coverage is protected. Questions? Contact 5000 0742.`
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
