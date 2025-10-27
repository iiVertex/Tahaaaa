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




// Rewards

export async function getRewards() {

  const { data } = await api.get('/rewards');

  return data?.data?.rewards || data?.data || data;

}

export async function redeemReward(id: string) {

  const { data } = await api.post('/rewards/redeem', { rewardId: id });

  return data;

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

  const { data } = await api.get('/profile');

  return data?.data || data;

}

export async function updateProfile(payload: any) {

  const { data } = await api.put('/profile', payload);

  return data;

}






