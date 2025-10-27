-- QIC Gamified Insurance App - Simplified Schema (No Authentication)
-- This schema focuses on content tables for the MVP without user authentication
-- User state will be managed in localStorage

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Mock friends/family data for social features
CREATE TABLE mock_friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('friend', 'family', 'colleague', 'mentor')),
    lifescore INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_missions_category ON missions(category);
CREATE INDEX idx_missions_difficulty ON missions(difficulty);
CREATE INDEX idx_missions_is_active ON missions(is_active);
CREATE INDEX idx_skill_trees_category ON skill_trees(category);
CREATE INDEX idx_rewards_type ON rewards(type);
CREATE INDEX idx_rewards_badge_rarity ON rewards(badge_rarity);
CREATE INDEX idx_scenarios_category ON scenarios(category);
CREATE INDEX idx_mock_friends_relationship_type ON mock_friends(relationship_type);

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_missions_updated_at
    BEFORE UPDATE ON missions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_skill_trees_updated_at
    BEFORE UPDATE ON skill_trees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_rewards_updated_at
    BEFORE UPDATE ON rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE missions IS 'Available missions and quests for users';
COMMENT ON TABLE skill_trees IS 'Skill tree structures and nodes';
COMMENT ON TABLE rewards IS 'Available rewards and badges';
COMMENT ON TABLE scenarios IS 'AI scenario simulations';
COMMENT ON TABLE mock_friends IS 'Mock friends/family data for social features';
