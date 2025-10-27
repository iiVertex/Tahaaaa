import axios from 'axios';
import { getOrCreateSessionId } from './session';

const baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL,
  headers: { 'x-session-id': getOrCreateSessionId() },
});

export async function health() {
  const { data } = await api.get('/health');
  return data;
}

// Missions
export async function getMissions() {
  const { data } = await api.get('/missions');
  // backend returns { data: { missions, pagination } }
  return data?.data?.missions || data?.data || data;
}
export async function startMission(id: string) {
  const { data } = await api.post('/missions/start', { missionId: id });
  return data;
}
export async function completeMission(id: string) {
  const { data } = await api.post('/missions/complete', { missionId: id });
  return data;
}

// Scenarios
export async function simulateScenario(payload: any) {
  const { data } = await api.post('/scenarios/simulate', payload);
  return data;
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


