-- QICLife MVP Schema (session-keyed, no users table)
-- Safe reset: drop tables in dependency order, then types.

BEGIN;

-- 1) Drop tables (child → parent)
DROP TABLE IF EXISTS openai_token_usage CASCADE;
DROP TABLE IF EXISTS user_token_limits CASCADE;

DROP TABLE IF EXISTS user_scenarios CASCADE;
DROP TABLE IF EXISTS user_rewards CASCADE;
DROP TABLE IF EXISTS user_skills CASCADE;
DROP TABLE IF EXISTS user_missions CASCADE;
DROP TABLE IF EXISTS social_connections CASCADE;
DROP TABLE IF EXISTS onboarding_responses CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS user_stats CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;

DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;

-- 2) Drop types (after tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_category') THEN
    DROP TYPE mission_category;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_difficulty') THEN
    DROP TYPE mission_difficulty;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_category') THEN
    DROP TYPE reward_category;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_rarity') THEN
    DROP TYPE reward_rarity;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_status') THEN
    DROP TYPE social_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
    DROP TYPE risk_level;
  END IF;
END$$;

-- 3) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 4) Types
CREATE TYPE mission_category AS ENUM ('safe_driving','health','financial_guardian','collaborative');
CREATE TYPE mission_difficulty AS ENUM ('easy','medium','hard','expert');
CREATE TYPE reward_category AS ENUM ('digital','physical','experiences','coins','badge');
CREATE TYPE reward_rarity AS ENUM ('common','rare','epic','legendary');
CREATE TYPE social_status AS ENUM ('pending','accepted','declined','blocked');
CREATE TYPE risk_level AS ENUM ('low','medium','high');

-- 5) Content tables (string IDs to match frontend-friendly codes)
CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  category mission_category NOT NULL,
  difficulty mission_difficulty NOT NULL DEFAULT 'medium',
  xp_reward INT NOT NULL DEFAULT 0,
  lifescore_impact INT NOT NULL DEFAULT 0,
  coin_reward INT NOT NULL DEFAULT 0,
  is_collaborative BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  description_en TEXT,
  description_ar TEXT,
  category mission_category NOT NULL,
  xp_cost INT NOT NULL DEFAULT 0,
  lifescore_bonus INT NOT NULL DEFAULT 0,
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rewards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  coin_cost INT NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 0,
  category reward_category NOT NULL,
  rarity reward_rarity NOT NULL DEFAULT 'common',
  available BOOLEAN NOT NULL DEFAULT TRUE,
  stock INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category mission_category NOT NULL,
  base_risk risk_level NOT NULL DEFAULT 'medium',
  inputs_schema JSONB,
  outputs_schema JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Session + Profile + Stats (session-keyed)
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE user_profiles (
  session_id TEXT PRIMARY KEY,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_stats (
  session_id TEXT PRIMARY KEY,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  coins INT NOT NULL DEFAULT 0,
  lifescore INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) User mappings (session-keyed)
CREATE TABLE user_missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','completed','joined','abandoned')),
  progress INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'redeemed',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  friend_name TEXT NOT NULL,
  status social_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk risk_level,
  lifescore_impact INT NOT NULL DEFAULT 0,
  xp_reward INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  step_number INT NOT NULL,
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) Token usage subsystem (session-keyed)
CREATE TABLE openai_token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_token_limits (
  session_id TEXT PRIMARY KEY,
  daily_limit INT NOT NULL DEFAULT 0,
  monthly_limit INT NOT NULL DEFAULT 0,
  used_today INT NOT NULL DEFAULT 0,
  used_this_month INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) Indexes
CREATE INDEX idx_user_sessions_session ON user_sessions(session_id);

CREATE INDEX idx_user_profiles_session ON user_profiles(session_id);
CREATE INDEX idx_user_stats_session ON user_stats(session_id);

CREATE INDEX idx_user_missions_session ON user_missions(session_id);
CREATE INDEX idx_user_missions_mission ON user_missions(mission_id);

CREATE INDEX idx_user_skills_session ON user_skills(session_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);

CREATE INDEX idx_user_rewards_session ON user_rewards(session_id);
CREATE INDEX idx_user_rewards_reward ON user_rewards(reward_id);

CREATE INDEX idx_social_session ON social_connections(session_id);
CREATE INDEX idx_social_status ON social_connections(status);

CREATE INDEX idx_user_scenarios_session ON user_scenarios(session_id);
CREATE INDEX idx_user_scenarios_scenario ON user_scenarios(scenario_id);

CREATE INDEX idx_onboarding_session ON onboarding_responses(session_id);
CREATE INDEX idx_onboarding_step ON onboarding_responses(step_number);

CREATE INDEX idx_token_usage_session ON openai_token_usage(session_id);
CREATE INDEX idx_token_usage_model ON openai_token_usage(model);

COMMIT;


