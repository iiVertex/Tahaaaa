import { api, getOfflineStatus } from './requests';
import { MissionSchema, ScenarioPredictionSchema, RewardSchema, ProfileSchema, AIRecommendationsSchema } from './schemas';
import { request } from './requests';

// Helper to check if error is network-related
function isNetworkError(error: any): boolean {
  return !error?.response && (
    error?.code === 'ERR_NETWORK' ||
    error?.code === 'ECONNREFUSED' ||
    error?.message?.includes('Network Error') ||
    error?.message?.includes('Failed to fetch')
  );
}

// Dev-only offline mocks
const isDev = import.meta.env.DEV;

// api instance provided by requests.ts

export async function health() {
  return request(() => api.get('/health'));
}

// Missions
export async function getMissions() {
  try {
    const raw = await request(() => api.get('/missions')) as any;
    // Backend returns: { success: true, data: { missions: [...], initialStageComplete: boolean, pagination: {...} } }
    // Or fallback formats for backward compatibility
    const missions = Array.isArray(raw?.data?.missions) 
      ? raw.data.missions 
      : Array.isArray(raw?.data) 
      ? raw.data 
      : Array.isArray(raw) 
      ? raw 
      : [];
    
    // Ensure missions have user_progress attached (backend includes it)
    const parsedMissions = missions.map((m: any) => {
      const parsed: any = MissionSchema.partial().parse(m);
      // Ensure user_progress is preserved if present
      if (m.user_progress) {
        parsed.user_progress = m.user_progress;
      }
      return parsed;
    });
    
    // Return missions with initialStageComplete flag
    const result: any = parsedMissions;
    result.initialStageComplete = raw?.data?.initialStageComplete ?? false;
    return result;
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock missions. Start backend with: npm run dev:both');
      const mockMissions = [
        { id: 'walk-10k', title_en: 'Walk 10,000 steps', category: 'health', difficulty: 'easy', xp_reward: 10, lifescore_impact: 2, coin_reward: 10 },
        { id: 'review-policy', title_en: 'Review your policy', category: 'insurance', difficulty: 'medium', xp_reward: 20, lifescore_impact: 5, coin_reward: 20 }
      ] as any;
      (mockMissions as any).initialStageComplete = false;
      return mockMissions;
    }
    throw error;
  }
}

export async function generateMissions() {
  try {
    const raw = await request(() => api.post('/missions/generate')) as any;
    // Backend returns: { success: true, data: { missions: [...] } }
    return raw?.data || raw || { missions: [] };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Mission generation unavailable. Start backend with: npm run dev:both');
      return { missions: [] };
    }
    throw error;
  }
}

export async function getDailyBrief() {
  try {
    const raw = await request(() => api.get('/missions/daily-brief')) as any;
    // Backend returns: { success: true, data: { daily_brief: "..." } }
    return raw?.data?.daily_brief || raw?.daily_brief || 'Welcome back! Ready for today\'s missions?';
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Daily brief unavailable. Start backend with: npm run dev:both');
      return 'Welcome back! Ready for today\'s missions?';
    }
    throw error;
  }
}

export async function generateDailyMissions() {
  try {
    const raw = await request(() => api.post('/missions/generate-daily')) as any;
    // Backend returns: { success: true, data: { missions: [...], alreadyReset: boolean } }
    return raw?.data || raw || { missions: [], alreadyReset: false };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Daily missions generation unavailable. Start backend with: npm run dev:both');
      return { missions: [], alreadyReset: false };
    }
    throw error;
  }
}

export async function startMission(id: string) {
  try {
    const raw = await request(() => api.post('/missions/start', { missionId: id })) as any;
    // Backend returns: { success: true, message: 'Mission started', data: { steps: [...] } }
    return raw?.data || raw || { steps: [] };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Mission start unavailable. Start backend with: npm run dev:both');
      return { steps: [] };
    }
    throw error;
  }
}

export async function getMissionSteps(missionId: string) {
  try {
    const raw = await request(() => api.get(`/missions/${missionId}/steps`)) as any;
    // Backend returns: { success: true, data: { steps: [...] } }
    return raw?.data || raw || { steps: [] };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock mission steps. Start backend with: npm run dev:both');
      return { steps: [] };
    }
    throw error;
  }
}

export async function completeMission(id: string) {
  try {
    const raw = await request(() => api.post('/missions/complete', { missionId: id })) as any;
    // Backend returns: { success: true, data: { coinsResult, xpResult, coins, xp, level, ... } }
    return raw?.data || raw || {};
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Mission completion unavailable. Start backend with: npm run dev:both');
      return { data: { coins: 0, xp: 0 } };
    }
    throw error;
  }
}

// Scenarios
export async function simulateScenario(payload: any) {
  // Load QIC terms JSON and include in payload
  let qicTerms = {};
  try {
    const termsModule = await import('../data/qic-terms.json');
    qicTerms = termsModule.default || termsModule;
  } catch (error) {
    console.warn('Failed to load QIC terms JSON:', error);
  }
  
  const payloadWithTerms = {
    ...payload,
    qicTerms
  };
  
  return request(() => api.post('/scenarios/simulate', payloadWithTerms), ScenarioPredictionSchema, payloadWithTerms);
}

// Showcase-specific alias (same as simulateScenario for clarity)
export const simulateShowcaseScenario = simulateScenario;

// AI recommendations (optional showcase helper)
export async function getRecommendations() {
  return request(() => api.get('/ai/recommendations'), AIRecommendationsSchema, { insights: [], suggested_missions: [], product_recommendations: [] });
}

// AI recommendations with context (preferences, etc.)
export async function getRecommendationsContext(context?: any) {
  // Backend expects context as a string (max 1000 chars) or { context?: string, type?: 'mission' | 'scenario' }
  // If context is an object (like { preferences }), stringify it and truncate to 1000 chars
  let contextString = '';
  if (context) {
    if (typeof context === 'string') {
      contextString = context.slice(0, 1000);
    } else if (typeof context === 'object' && !Array.isArray(context)) {
      contextString = JSON.stringify(context).slice(0, 1000);
    }
  }
  
  const contextPayload: { context?: string; type?: string } = {};
  if (contextString) {
    contextPayload.context = contextString;
  }
  contextPayload.type = 'mission';
  
  try {
    return request(() => api.post('/ai/recommendations', contextPayload), AIRecommendationsSchema, { insights: [], suggested_missions: [], product_recommendations: [] });
  } catch (error: any) {
    // If 400/429 errors occur (validation or rate limit), fallback to GET endpoint
    if (error?.response?.status === 400 || error?.response?.status === 429) {
      console.warn('[AI Recommendations] POST failed (validation/rate limit), falling back to GET endpoint');
      return request(() => api.get('/ai/recommendations'), AIRecommendationsSchema, { insights: [], suggested_missions: [], product_recommendations: [] });
    }
    throw error;
  }
}

// Dedicated Insights endpoint (alias to recommendations.insights)
export async function getAIInsights() {
  const data = await request(() => api.get('/ai/recommendations'), AIRecommendationsSchema, { insights: [], suggested_missions: [], product_recommendations: [] });
  return (data as any)?.insights || [];
}

// Offers / Products
export async function getPrequalifiedOffers() {
  const r = await getRecommendations();
  return (r as any)?.product_recommendations || [];
}

// Products
export async function getProductsCatalog() {
  try {
    const d = await request(() => api.get('/products/catalog')) as any;
    return d?.products || d?.data?.products || [];
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock products. Start backend with: npm run dev:both');
      return [
        { id: 'auto_plus', name: 'Auto Plus', type: 'car', price: 1500 },
        { id: 'home_secure', name: 'Home Secure', type: 'home', price: 800 }
      ] as any;
    }
    throw error;
  }
}
export async function getBundleSavings(productIds: string[]) {
  return request(() => api.post('/products/bundle-savings', { product_ids: productIds }));
}

// Quotes
export async function startQuote(payload: any) {
  return request(() => api.post('/quotes/start', payload));
}
export async function getQuoteStatus(id: string) {
  return request(() => api.get(`/quotes/${id}/status`));
}

// Referrals
export async function shareReferral(context?: any) {
  return request(() => api.post('/referrals/share', context || {}));
}

// Plan Detail Generation
export async function simulatePlanDetail(data: { plan: any; user_profile: any; scenario_description?: string }) {
  return request(() => api.post('/ai/plan-detail', data));
}

// Analytics
export async function trackEvent(name: string, props?: any) {
  try { await api.post('/analytics/events', { name, props, ts: new Date().toISOString() }); } catch {}
}

// Rewards
export async function getRewards() {
  try {
    const raw = await request(() => api.get('/rewards')) as any;
    const rewards = Array.isArray(raw?.data?.rewards) ? raw.data.rewards : Array.isArray(raw) ? raw : raw?.data || [];
    // Filter out null/undefined and safely parse
    return rewards
      .filter((r: any) => r != null && typeof r === 'object')
      .map((r: any) => {
        try {
          return RewardSchema.partial().parse(r);
        } catch (parseError) {
          console.warn('[getRewards] Failed to parse reward:', r, parseError);
          // Return a minimal valid reward object
          return {
            id: r.id || `reward-${Date.now()}`,
            title: r.title || r.title_en || 'Unknown Reward',
            coins_cost: r.coins_cost || 0,
            ...r
          };
        }
      });
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock rewards. Start backend with: npm run dev:both');
      return [
        { id: 'discount-10', name: '10% Discount', coins_required: 100, type: 'discount' },
        { id: 'free-consultation', name: 'Free Consultation', coins_required: 50, type: 'service' }
      ] as any;
    }
    throw error;
  }
}
export async function redeemReward(id: string) {
  return request(() => api.post('/rewards/redeem', { rewardId: id }));
}

// Social
export async function getSocialFeed() {
  // use leaderboard and friends as a basic feed
  const [friends, leaderboard] = await Promise.all([
    api.get('/social/friends'),
    api.get('/social/leaderboard'),
  ]);
  return { friends: friends.data?.data?.friends || [], leaderboard: leaderboard.data?.data?.leaderboard || [] };
}

// Profile
export async function getProfile() {
  try {
    const raw = await request(() => api.get('/profile')) as any;
    // Backend returns: { success: true, data: { user: {...}, userProfile: { profile_json: {...}, stats: {...}, ... } } }
    // Frontend expects: { data: { userProfile: { profile_json: {...}, stats: {...} } } } or direct { userProfile: {...} }
    if (raw?.data?.userProfile) {
      return raw.data;
    } else if (raw?.userProfile) {
      return raw;
    } else if (raw?.data) {
      // Fallback: wrap in expected structure
      return { userProfile: { profile_json: raw.data.profile || {}, stats: raw.data.stats || {} } };
    }
    return raw || {} as any;
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock profile. Start backend with: npm run dev:both');
      return {
        userProfile: { profile_json: { preferences: { interests: ['health', 'insurance'] } } },
        stats: { xp: 100, level: 2, lifescore: 75 }
      } as any;
    }
    throw error;
  }
}
export async function updateProfile(payload: any) {
  return request(() => api.put('/profile', payload));
}

// Achievements
export async function getAchievements() {
  try {
    const d = await request(() => api.get('/achievements')) as any;
    return d?.achievements || d?.data?.achievements || [];
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock achievements. Start backend with: npm run dev:both');
      return [
        { id: 'first-mission', name: 'First Mission', description: 'Complete your first mission' }
      ] as any;
    }
    throw error;
  }
}
export async function getUserAchievements() {
  try {
    const d = await request(() => api.get('/achievements/user')) as any;
    return d?.user_achievements || d?.data?.user_achievements || [];
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock user achievements. Start backend with: npm run dev:both');
      return [] as any;
    }
    throw error;
  }
}

// Purchases (multiproduct)
export async function recordPurchase(purchase: { product_id: string; product_type: string; product_name: string; purchase_amount: number; currency?: string; policy_number?: string; metadata?: any; }) {
  return request(() => api.post('/multiproduct/purchase', purchase));
}

// Play - Road-Trip Roulette
export async function getRemainingSpins() {
  try {
    const raw = await request(() => api.get('/play/roulette/spins-remaining')) as any;
    return raw?.data || { remaining: 3, canSpin: true, spinCount: 0, maxSpins: 3 };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock spin limit. Start backend with: npm run dev:both');
      return { remaining: 3, canSpin: true, spinCount: 0, maxSpins: 3 };
    }
    throw error;
  }
}

export async function spinRoulette() {
  try {
    const raw = await request(() => api.post('/play/roulette/spin')) as any;
    return raw?.data || { wheel_spin_result: 'Doha Adventure', itinerary: [], ctas: [], reward: '100 QIC Coins', coins_earned: 100, xp_earned: 50, remaining: 2 };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Using mock roulette spin. Start backend with: npm run dev:both');
      return { wheel_spin_result: 'Doha Adventure', itinerary: [], ctas: [], reward: '100 QIC Coins', coins_earned: 100, xp_earned: 50, remaining: 2 };
    }
    throw error;
  }
}

// Ecosystem feature usage (throttled)
const featureLastSent = new Map<string, number>();
let offlineWarningShown = false;
export async function trackFeatureUsage(featureName: string, metadata?: any) {
  try {
    await api.post('/ecosystem/track', { featureName, metadata });
  } catch (error: any) {
    if (isDev && isNetworkError(error) && !offlineWarningShown) {
      console.info('[Backend unavailable] Analytics tracking disabled. Start backend with: npm run dev:both');
      offlineWarningShown = true;
    }
  }
}
export async function trackFeatureUsageThrottled(featureName: string, metadata?: any, windowMs = 3000) {
  const now = Date.now();
  const last = featureLastSent.get(featureName) || 0;
  if (now - last < windowMs) return;
  featureLastSent.set(featureName, now);
  try {
    await api.post('/ecosystem/track', { featureName, metadata });
  } catch (error: any) {
    if (isDev && isNetworkError(error) && !offlineWarningShown) {
      console.info('[Backend unavailable] Analytics tracking disabled. Start backend with: npm run dev:both');
      offlineWarningShown = true;
    }
  }
}

// Bundle Save
export async function saveBundle(bundleData: any) {
  try {
    const raw = await request(() => api.post('/bundles/save', bundleData)) as any;
    return raw?.data || raw || { success: true };
  } catch (error: any) {
    if (isDev && isNetworkError(error)) {
      console.info('[Backend unavailable] Bundle save unavailable. Start backend with: npm run dev:both');
      throw new Error('Backend unavailable. Please ensure backend is running.');
    }
    throw error;
  }
}

