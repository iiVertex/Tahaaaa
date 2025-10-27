// Minimal domain types for JSDoc import types

export interface User {
  id: string;
  email: string;
  username?: string;
  lifescore: number;
  xp: number;
  level: number;
  current_streak?: number;
  longest_streak?: number;
  coins: number;
}

export interface Mission {
  id: string;
  category: 'safe_driving' | 'health' | 'financial_guardian' | 'family_protection' | 'lifestyle';
  title_en: string;
  description_en?: string;
  difficulty: 'easy'|'medium'|'hard'|'expert';
  xp_reward: number;
  lifescore_impact: number;
}

export interface UserMission {
  id?: string;
  user_id: string;
  mission_id: string;
  status: 'available'|'active'|'completed'|'failed'|'locked';
  progress: number;
  started_at?: string;
  completed_at?: string;
}


