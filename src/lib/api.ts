import { api } from './requests';
import { MissionSchema, ScenarioPredictionSchema, RewardSchema, ProfileSchema, AIRecommendationsSchema } from './schemas';
import { request } from './requests';

// api instance provided by requests.ts

export async function health() {
  return request(() => api.get('/health'));
}

// Missions
export async function getMissions() {
  const raw = await request(() => api.get('/missions')) as any;
  const missions = Array.isArray(raw?.data?.missions) ? raw.data.missions : Array.isArray(raw) ? raw : raw?.data || [];
  return missions.map((m: any) => MissionSchema.partial().parse(m));
}
export async function startMission(id: string) {
  return request(() => api.post('/missions/start', { missionId: id }));
}
export async function completeMission(id: string) {
  return request(() => api.post('/missions/complete', { missionId: id }));
}

// Scenarios
export async function simulateScenario(payload: any) {
  return request(() => api.post('/scenarios/simulate', payload), ScenarioPredictionSchema, payload);
}

// Showcase-specific alias (same as simulateScenario for clarity)
export const simulateShowcaseScenario = simulateScenario;

// AI recommendations (optional showcase helper)
export async function getRecommendations() {
  return request(() => api.get('/ai/recommendations'), AIRecommendationsSchema, { insights: [], suggested_missions: [] });
}

// Dedicated Insights endpoint (alias to recommendations.insights)
export async function getAIInsights() {
  const data = await request(() => api.get('/ai/recommendations'), AIRecommendationsSchema, { insights: [], suggested_missions: [] });
  return (data as any)?.insights || [];
}

// Offers / Products
export async function getPrequalifiedOffers() {
  const r = await getRecommendations();
  return (r as any)?.product_recommendations || [];
}

// Products
export async function getProductsCatalog() {
  const d = await request(() => api.get('/products/catalog')) as any;
  return d?.products || d?.data?.products || [];
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
export async function shareReferral() {
  return request(() => api.post('/referrals/share', {}));
}

// Analytics
export async function trackEvent(name: string, props?: any) {
  try { await api.post('/analytics/events', { name, props, ts: new Date().toISOString() }); } catch {}
}

// Rewards
export async function getRewards() {
  const raw = await request(() => api.get('/rewards')) as any;
  const rewards = Array.isArray(raw?.data?.rewards) ? raw.data.rewards : Array.isArray(raw) ? raw : raw?.data || [];
  return rewards.map((r: any) => RewardSchema.partial().parse(r));
}
export async function redeemReward(id: string) {
  return request(() => api.post('/rewards/redeem', { rewardId: id }));
}

// Skill Tree removed per Track 1 alignment

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
  return request(() => api.get('/profile'), ProfileSchema.optional(), {} as any);
}
export async function updateProfile(payload: any) {
  return request(() => api.put('/profile', payload));
}

// Achievements
export async function getAchievements() {
  const d = await request(() => api.get('/achievements')) as any;
  return d?.achievements || d?.data?.achievements || [];
}
export async function getUserAchievements() {
  const d = await request(() => api.get('/achievements/user')) as any;
  return d?.user_achievements || d?.data?.user_achievements || [];
}

