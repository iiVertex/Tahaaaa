-- QIC Gamified Insurance App Database Schema
-- This file contains all tables, relationships, indexes, and RLS policies
-- Execute this file in your Supabase SQL editor to set up the complete database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Core user information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    lifescore INTEGER DEFAULT 0 CHECK (lifescore >= 0 AND lifescore <= 1000),
    xp INTEGER DEFAULT 0 CHECK (xp >= 0),
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
    avatar_config JSONB DEFAULT '{}',
    language_preference VARCHAR(5) DEFAULT 'en' CHECK (language_preference IN ('en', 'ar', 'fr', 'es', 'de', 'zh')),
    theme_preference VARCHAR(10) DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
    coins INTEGER DEFAULT 0 CHECK (coins >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Missions table - Available missions and quests
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL CHECK (category IN ('safe_driving', 'health', 'financial_guardian', 'family_protection', 'lifestyle')),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    xp_reward INTEGER NOT NULL CHECK (xp_reward > 0),
    lifescore_impact INTEGER NOT NULL CHECK (lifescore_impact >= -50 AND lifescore_impact <= 50),
    requirements JSONB DEFAULT '{}',
    is_collaborative BOOLEAN DEFAULT FALSE,
    max_participants INTEGER DEFAULT 1 CHECK (max_participants >= 1),
    duration_days INTEGER DEFAULT 7 CHECK (duration_days > 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User missions - Track user progress on missions
CREATE TABLE user_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed', 'locked')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    xp_earned INTEGER DEFAULT 0 CHECK (xp_earned >= 0),
    lifescore_change INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mission_id)
);

-- Skill trees - Define skill tree structures
CREATE TABLE skill_trees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL CHECK (category IN ('safe_driving', 'health', 'financial_guardian', 'family_protection', 'lifestyle')),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    nodes JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User skills - Track user progress in skill trees
CREATE TABLE user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skill_trees(id) ON DELETE CASCADE,
    skill_node_id VARCHAR(100) NOT NULL,
    unlocked BOOLEAN DEFAULT FALSE,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_id, skill_node_id)
);

-- Rewards table - Available rewards and badges
CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('badge', 'coin_boost', 'partner_offer', 'streak_bonus', 'achievement')),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    coins_cost INTEGER DEFAULT 0 CHECK (coins_cost >= 0),
    badge_icon VARCHAR(100),
    badge_rarity VARCHAR(20) DEFAULT 'common' CHECK (badge_rarity IN ('common', 'rare', 'epic', 'legendary')),
    partner_offer JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User rewards - Track earned rewards
CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, reward_id)
);

-- Social connections - Friends and family relationships
CREATE TABLE social_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('friend', 'family', 'colleague', 'mentor')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Scenarios - AI scenario simulations
CREATE TABLE scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('lifestyle', 'travel', 'policy_change', 'life_event')),
    input_params JSONB NOT NULL DEFAULT '{}',
    ai_predictions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User scenarios - Track user scenario simulations
CREATE TABLE user_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    inputs JSONB NOT NULL DEFAULT '{}',
    results JSONB DEFAULT '{}',
    lifescore_impact INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborative missions - Group mission tracking
CREATE TABLE collaborative_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participants JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI recommendations - Store AI-generated recommendations
CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mission', 'skill', 'scenario', 'social', 'reward')),
    title_en VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_ar TEXT,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    context JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_lifescore ON users(lifescore);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_user_missions_user_id ON user_missions(user_id);
CREATE INDEX idx_user_missions_mission_id ON user_missions(mission_id);
CREATE INDEX idx_user_missions_status ON user_missions(status);
CREATE INDEX idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill_id ON user_skills(skill_id);
CREATE INDEX idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_reward_id ON user_rewards(reward_id);
CREATE INDEX idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX idx_social_connections_friend_id ON social_connections(friend_id);
CREATE INDEX idx_user_scenarios_user_id ON user_scenarios(user_id);
CREATE INDEX idx_user_scenarios_scenario_id ON user_scenarios(scenario_id);
CREATE INDEX idx_ai_recommendations_user_id ON ai_recommendations(user_id);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(type);

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate level based on XP (100 XP per level)
    NEW.level = (NEW.xp / 100) + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_user_level
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_level();

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_missions_updated_at
    BEFORE UPDATE ON missions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_user_missions_updated_at
    BEFORE UPDATE ON user_missions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_skill_trees_updated_at
    BEFORE UPDATE ON skill_trees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_user_skills_updated_at
    BEFORE UPDATE ON user_skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_rewards_updated_at
    BEFORE UPDATE ON rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_social_connections_updated_at
    BEFORE UPDATE ON social_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_collaborative_missions_updated_at
    BEFORE UPDATE ON collaborative_missions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) Policies
-- Note: These are commented out for manual setup. Uncomment and adjust as needed.

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_scenarios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE collaborative_missions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (uncomment and modify as needed):
-- CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
-- CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
-- CREATE POLICY "Users can view own missions" ON user_missions FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can update own missions" ON user_missions FOR UPDATE USING (auth.uid() = user_id);

-- Insert sample data (optional - for testing)
-- INSERT INTO users (email, lifescore, xp, level, streak_days, language_preference) VALUES
-- ('test@example.com', 750, 250, 3, 5, 'en');

-- INSERT INTO missions (category, title_en, title_ar, description_en, description_ar, difficulty, xp_reward, lifescore_impact) VALUES
-- ('safe_driving', 'Safe Driver Challenge', 'تحدي السائق الآمن', 'Complete 7 days of safe driving', 'أكمل 7 أيام من القيادة الآمنة', 'medium', 50, 10);

-- INSERT INTO skill_trees (category, title_en, title_ar, nodes) VALUES
-- ('safe_driving', 'Safe Driving Skills', 'مهارات القيادة الآمنة', '[{"id": "defensive_driving", "title": "Defensive Driving", "unlocked": true, "children": ["speed_control", "distance_keeping"]}]');

-- INSERT INTO rewards (type, title_en, title_ar, badge_icon, badge_rarity) VALUES
-- ('badge', 'Safe Driver', 'سائق آمن', 'shield', 'rare');

COMMENT ON TABLE users IS 'Core user information including gamification stats';
COMMENT ON TABLE missions IS 'Available missions and quests for users';
COMMENT ON TABLE user_missions IS 'User progress tracking for missions';
COMMENT ON TABLE skill_trees IS 'Skill tree structures and nodes';
COMMENT ON TABLE user_skills IS 'User progress in skill trees';
COMMENT ON TABLE rewards IS 'Available rewards and badges';
COMMENT ON TABLE user_rewards IS 'User earned rewards';
COMMENT ON TABLE social_connections IS 'Friends and family relationships';
COMMENT ON TABLE scenarios IS 'AI scenario simulations';
COMMENT ON TABLE user_scenarios IS 'User scenario simulation results';
COMMENT ON TABLE collaborative_missions IS 'Group mission tracking';
COMMENT ON TABLE ai_recommendations IS 'AI-generated recommendations for users';
