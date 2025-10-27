-- QIC Life Track 1 - Complete Database Schema
-- Comprehensive production-ready Supabase PostgreSQL schema for AI-powered gamification
-- Supports the complete engagement loop: Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity
-- Execute this file in Supabase SQL editor to set up the complete database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table - Enhanced with behavior tracking fields
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE, -- for social features
    phone_number VARCHAR(20), -- for notifications
    lifescore INTEGER DEFAULT 0 CHECK (lifescore >= 0 AND lifescore <= 100),
    xp INTEGER DEFAULT 0 CHECK (xp >= 0),
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    streak_days INTEGER DEFAULT 0 CHECK (streak_days >= 0),
    longest_streak INTEGER DEFAULT 0 CHECK (longest_streak >= 0), -- gamification metric
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- engagement tracking
    timezone VARCHAR(50) DEFAULT 'Asia/Qatar',
    notification_preferences JSONB DEFAULT '{"push": true, "email": true, "sms": false}', -- push notification settings
    avatar_config JSONB DEFAULT '{}',
    language_preference VARCHAR(5) DEFAULT 'en' CHECK (language_preference IN ('en', 'ar', 'fr', 'es', 'de', 'zh')),
    theme_preference VARCHAR(10) DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
    coins INTEGER DEFAULT 0 CHECK (coins >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Behavior Events Table - Critical for AI analysis
CREATE TABLE user_behavior_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'mission_start', 'mission_complete', 'mission_fail', 'reward_redeem', 
        'login', 'logout', 'scenario_simulate', 'profile_update', 'achievement_earn',
        'notification_open', 'app_open', 'streak_milestone', 'lifescore_milestone'
    )),
    event_data JSONB DEFAULT '{}', -- flexible event context
    lifescore_before INTEGER CHECK (lifescore_before >= 0 AND lifescore_before <= 100),
    lifescore_after INTEGER CHECK (lifescore_after >= 0 AND lifescore_after <= 100),
    session_id VARCHAR(255), -- for session tracking
    device_info JSONB DEFAULT '{}', -- browser, OS, app version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LifeScore History Table - Track LifeScore changes over time
CREATE TABLE lifescore_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_score INTEGER NOT NULL CHECK (old_score >= 0 AND old_score <= 100),
    new_score INTEGER NOT NULL CHECK (new_score >= 0 AND new_score <= 100),
    change_reason VARCHAR(100) NOT NULL CHECK (change_reason IN (
        'mission_complete', 'scenario_penalty', 'streak_bonus', 'achievement_reward',
        'manual_update', 'daily_bonus', 'weekly_bonus', 'onboarding_complete'
    )),
    mission_id UUID REFERENCES missions(id), -- optional foreign key
    achievement_id UUID REFERENCES achievements(id), -- optional foreign key
    change_amount INTEGER GENERATED ALWAYS AS (new_score - old_score) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Recommendations Table - Store AI-generated personalized recommendations
CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('mission', 'product', 'scenario', 'achievement')),
    target_id UUID, -- mission_id, product_id, scenario_id, or achievement_id
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.00 to 1.00
    reasoning TEXT, -- AI explanation
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Recommendations Table - Cross-sell tracking for QIC products
CREATE TABLE product_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_type VARCHAR(50) NOT NULL CHECK (product_type IN (
        'motor_insurance', 'health_insurance', 'life_insurance', 'travel_insurance',
        'home_insurance', 'pet_insurance', 'business_insurance'
    )),
    product_name VARCHAR(255) NOT NULL,
    recommended_by VARCHAR(20) NOT NULL CHECK (recommended_by IN (
        'ai', 'mission_complete', 'lifescore_milestone', 'behavior_pattern', 'admin'
    )),
    priority INTEGER NOT NULL CHECK (priority >= 1 AND priority <= 5), -- 1-5
    status VARCHAR(20) DEFAULT 'recommended' CHECK (status IN (
        'recommended', 'viewed', 'interested', 'purchased', 'dismissed'
    )),
    metadata JSONB DEFAULT '{}', -- product details, pricing, discounts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    viewed_at TIMESTAMP WITH TIME ZONE,
    actioned_at TIMESTAMP WITH TIME ZONE
);

-- Missions table - Enhanced with gamification fields
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
    coin_reward INTEGER DEFAULT 0 CHECK (coin_reward >= 0), -- reward coins alongside XP
    requirements JSONB DEFAULT '{}',
    is_collaborative BOOLEAN DEFAULT FALSE,
    max_participants INTEGER DEFAULT 1 CHECK (max_participants >= 1),
    duration_days INTEGER DEFAULT 7 CHECK (duration_days > 0),
    recurrence_type VARCHAR(20) DEFAULT 'one_time' CHECK (recurrence_type IN ('daily', 'weekly', 'one_time')), -- for daily/weekly missions
    next_available_at TIMESTAMP WITH TIME ZONE, -- for daily/weekly missions
    ai_generated BOOLEAN DEFAULT FALSE, -- track AI-created missions
    product_spotlight VARCHAR(255), -- which QIC product this promotes
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mission Instances Table - Track mission resets for recurring missions
CREATE TABLE mission_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL,
    available_from TIMESTAMP WITH TIME ZONE NOT NULL,
    available_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_expired BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mission_id, instance_date)
);

-- User missions - Track user progress on missions
CREATE TABLE user_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    mission_instance_id UUID REFERENCES mission_instances(id) ON DELETE CASCADE, -- for recurring missions
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed', 'locked')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    xp_earned INTEGER DEFAULT 0 CHECK (xp_earned >= 0),
    lifescore_change INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mission_id, mission_instance_id)
);

-- Achievements Table - Milestone badges for engagement
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    description_en TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    badge_icon VARCHAR(100) NOT NULL,
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN (
        'lifescore_milestone', 'streak_count', 'missions_completed', 'xp_milestone',
        'coins_earned', 'days_active', 'scenarios_completed', 'rewards_redeemed'
    )),
    condition_value INTEGER NOT NULL CHECK (condition_value > 0),
    xp_reward INTEGER DEFAULT 0 CHECK (xp_reward >= 0),
    coin_reward INTEGER DEFAULT 0 CHECK (coin_reward >= 0),
    lifescore_boost INTEGER DEFAULT 0 CHECK (lifescore_boost >= 0),
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Achievements Table - Track earned achievements
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notification_sent BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, achievement_id)
);

-- Notifications Table - Push notification tracking
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'mission_reminder', 'reward_available', 'streak_reminder', 'lifescore_update',
        'achievement_earned', 'product_recommendation', 'daily_challenge', 'weekly_summary'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions Table - Track login patterns for AI
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}', -- browser, OS, app version
    ip_address VARCHAR(45),
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    is_active BOOLEAN DEFAULT TRUE
);

-- Rewards table - Rewards Hub (coins → offers)
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

-- User rewards - Track reward redemptions
CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'redeemed' CHECK (status IN ('redeemed', 'pending', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scenarios table - Scenario Simulation (what-if AI projections)
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

-- User scenarios - Track scenario simulations
CREATE TABLE user_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL DEFAULT '{}',
    result_data JSONB NOT NULL DEFAULT '{}',
    lifescore_impact INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social connections - Optional leaderboards & social proof
CREATE TABLE social_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- User profiles - Enhanced with AI-specific fields
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_json JSONB NOT NULL DEFAULT '{}',
    encrypted_data TEXT,
    ai_personality_type VARCHAR(50) DEFAULT 'encouraging' CHECK (ai_personality_type IN ('encouraging', 'competitive', 'educational', 'supportive')),
    last_ai_analysis_at TIMESTAMP WITH TIME ZONE,
    behavior_summary JSONB DEFAULT '{}', -- AI-generated behavior insights
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding responses - Quiz data for AI personalization
CREATE TABLE onboarding_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number >= 1 AND step_number <= 7),
    response_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Core user indexes
CREATE INDEX idx_users_lifescore ON users(lifescore);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_xp ON users(xp);
CREATE INDEX idx_users_streak ON users(streak_days);
CREATE INDEX idx_users_last_active ON users(last_active_at DESC);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;

-- User behavior analysis indexes
CREATE INDEX idx_behavior_events_user_type ON user_behavior_events(user_id, event_type);
CREATE INDEX idx_behavior_events_created ON user_behavior_events(created_at DESC);
CREATE INDEX idx_behavior_events_session ON user_behavior_events(session_id) WHERE session_id IS NOT NULL;

-- LifeScore trending indexes
CREATE INDEX idx_lifescore_history_user ON lifescore_history(user_id, created_at DESC);
CREATE INDEX idx_lifescore_history_reason ON lifescore_history(change_reason);
CREATE INDEX idx_lifescore_history_amount ON lifescore_history(change_amount);

-- AI recommendations indexes
CREATE INDEX idx_ai_recs_user_status ON ai_recommendations(user_id, status);
CREATE INDEX idx_ai_recs_expires ON ai_recommendations(expires_at) WHERE status = 'pending';
CREATE INDEX idx_ai_recs_type ON ai_recommendations(recommendation_type);
CREATE INDEX idx_ai_recs_confidence ON ai_recommendations(confidence_score DESC);

-- Product recommendations indexes
CREATE INDEX idx_product_recs_user_status ON product_recommendations(user_id, status);
CREATE INDEX idx_product_recs_priority ON product_recommendations(priority DESC);
CREATE INDEX idx_product_recs_type ON product_recommendations(product_type);
CREATE INDEX idx_product_recs_recommended_by ON product_recommendations(recommended_by);

-- Mission indexes
CREATE INDEX idx_missions_category ON missions(category);
CREATE INDEX idx_missions_difficulty ON missions(difficulty);
CREATE INDEX idx_missions_is_active ON missions(is_active);
CREATE INDEX idx_missions_recurrence ON missions(recurrence_type);
CREATE INDEX idx_missions_next_available ON missions(next_available_at) WHERE next_available_at IS NOT NULL;
CREATE INDEX idx_missions_category_difficulty ON missions(category, difficulty, is_active);

-- Mission instances indexes
CREATE INDEX idx_mission_instances_mission ON mission_instances(mission_id);
CREATE INDEX idx_mission_instances_date ON mission_instances(instance_date);
CREATE INDEX idx_mission_instances_available ON mission_instances(available_from, available_until);

-- User missions indexes
CREATE INDEX idx_user_missions_user_id ON user_missions(user_id);
CREATE INDEX idx_user_missions_mission_id ON user_missions(mission_id);
CREATE INDEX idx_user_missions_status ON user_missions(status);
CREATE INDEX idx_user_missions_status_started ON user_missions(user_id, status, started_at DESC);
CREATE INDEX idx_user_missions_instance ON user_missions(mission_instance_id) WHERE mission_instance_id IS NOT NULL;

-- Achievement indexes
CREATE INDEX idx_achievements_type ON achievements(condition_type);
CREATE INDEX idx_achievements_active ON achievements(is_active);
CREATE INDEX idx_achievements_rarity ON achievements(rarity);

-- User achievements indexes
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_earned ON user_achievements(earned_at DESC);

-- Notification indexes
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_sent ON notifications(sent_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_priority ON notifications(priority);

-- User sessions indexes
CREATE INDEX idx_sessions_user_started ON user_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- Rewards indexes
CREATE INDEX idx_rewards_type ON rewards(type);
CREATE INDEX idx_rewards_badge_rarity ON rewards(badge_rarity);
CREATE INDEX idx_rewards_coins_cost ON rewards(coins_cost);

-- User rewards indexes
CREATE INDEX idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_reward_id ON user_rewards(reward_id);

-- Scenario indexes
CREATE INDEX idx_scenarios_category ON scenarios(category);
CREATE INDEX idx_scenarios_is_active ON scenarios(is_active);

-- User scenarios indexes
CREATE INDEX idx_user_scenarios_user_id ON user_scenarios(user_id);
CREATE INDEX idx_user_scenarios_scenario_id ON user_scenarios(scenario_id);

-- Social connections indexes
CREATE INDEX idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX idx_social_connections_friend_id ON social_connections(friend_id);
CREATE INDEX idx_social_connections_status ON social_connections(status);

-- User profiles indexes
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_ai_type ON user_profiles(ai_personality_type);
CREATE INDEX idx_user_profiles_analysis ON user_profiles(last_ai_analysis_at DESC);

-- Onboarding responses indexes
CREATE INDEX idx_onboarding_responses_user_id ON onboarding_responses(user_id);
CREATE INDEX idx_onboarding_responses_step ON onboarding_responses(step_number);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- User engagement summary
CREATE MATERIALIZED VIEW user_engagement_summary AS
SELECT 
    user_id,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    COUNT(*) as total_events,
    MAX(created_at) as last_activity,
    COUNT(DISTINCT event_type) as unique_event_types
FROM user_behavior_events
GROUP BY user_id;

CREATE INDEX idx_engagement_summary_user ON user_engagement_summary(user_id);

-- User mission completion rates
CREATE MATERIALIZED VIEW user_mission_stats AS
SELECT 
    user_id,
    COUNT(*) as total_missions_started,
    COUNT(*) FILTER (WHERE status = 'completed') as missions_completed,
    COUNT(*) FILTER (WHERE status = 'failed') as missions_failed,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as completion_rate,
    SUM(xp_earned) as total_xp_earned,
    SUM(lifescore_change) as total_lifescore_change
FROM user_missions
GROUP BY user_id;

CREATE INDEX idx_mission_stats_user ON user_mission_stats(user_id);

-- ============================================================================
-- DATA INTEGRITY & CONSTRAINTS
-- ============================================================================

-- User missions progress validation
ALTER TABLE user_missions ADD CONSTRAINT check_progress_complete 
    CHECK (status != 'completed' OR progress = 100);

-- LifeScore change reasonableness
ALTER TABLE lifescore_history ADD CONSTRAINT check_score_change_reasonable
    CHECK (ABS(new_score - old_score) <= 50);

-- AI confidence score range
ALTER TABLE ai_recommendations ADD CONSTRAINT check_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1);

-- Mission instance date validation
ALTER TABLE mission_instances ADD CONSTRAINT check_instance_date_valid
    CHECK (available_until > available_from);

-- Session duration validation
ALTER TABLE user_sessions ADD CONSTRAINT check_session_duration
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- LifeScore Update Trigger
CREATE OR REPLACE FUNCTION track_lifescore_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lifescore != OLD.lifescore THEN
        INSERT INTO lifescore_history (user_id, old_score, new_score, change_reason)
        VALUES (NEW.id, OLD.lifescore, NEW.lifescore, 'manual_update');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-expire Old Recommendations Function
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS void AS $$
BEGIN
    UPDATE ai_recommendations
    SET status = 'expired'
    WHERE expires_at < NOW() AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW user_engagement_summary;
    REFRESH MATERIALIZED VIEW user_mission_stats;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
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

CREATE TRIGGER trigger_update_rewards_updated_at
    BEFORE UPDATE ON rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_social_connections_updated_at
    BEFORE UPDATE ON social_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_ai_recommendations_updated_at
    BEFORE UPDATE ON ai_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_achievements_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- LifeScore change tracking trigger
CREATE TRIGGER trigger_track_lifescore_change
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.lifescore IS DISTINCT FROM NEW.lifescore)
    EXECUTE FUNCTION track_lifescore_change();

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifescore_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY users_select_own ON users
    FOR SELECT USING (auth.uid() = id);
    
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);

-- User behavior events policies
CREATE POLICY behavior_events_select_own ON user_behavior_events
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY behavior_events_insert_own ON user_behavior_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- LifeScore history policies
CREATE POLICY lifescore_history_select_own ON lifescore_history
    FOR SELECT USING (auth.uid() = user_id);

-- AI recommendations policies
CREATE POLICY ai_recs_select_own ON ai_recommendations
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY ai_recs_update_own ON ai_recommendations
    FOR UPDATE USING (auth.uid() = user_id);

-- Product recommendations policies
CREATE POLICY product_recs_select_own ON product_recommendations
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY product_recs_update_own ON product_recommendations
    FOR UPDATE USING (auth.uid() = user_id);

-- Missions policies
CREATE POLICY missions_select_all ON missions
    FOR SELECT USING (is_active = TRUE);
    
CREATE POLICY missions_admin_all ON missions
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Mission instances policies
CREATE POLICY mission_instances_select_all ON mission_instances
    FOR SELECT USING (true);

-- User missions policies
CREATE POLICY user_missions_select_own ON user_missions
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY user_missions_insert_own ON user_missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY user_missions_update_own ON user_missions
    FOR UPDATE USING (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY achievements_select_all ON achievements
    FOR SELECT USING (is_active = TRUE);

-- User achievements policies
CREATE POLICY user_achievements_select_own ON user_achievements
    FOR SELECT USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY notifications_select_own ON notifications
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- User sessions policies
CREATE POLICY sessions_select_own ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY sessions_insert_own ON user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rewards policies
CREATE POLICY rewards_select_all ON rewards
    FOR SELECT USING (is_active = TRUE);

-- User rewards policies
CREATE POLICY user_rewards_select_own ON user_rewards
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY user_rewards_insert_own ON user_rewards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Scenarios policies
CREATE POLICY scenarios_select_all ON scenarios
    FOR SELECT USING (is_active = TRUE);

-- User scenarios policies
CREATE POLICY user_scenarios_select_own ON user_scenarios
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY user_scenarios_insert_own ON user_scenarios
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Social connections policies
CREATE POLICY social_connections_select_own ON social_connections
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
    
CREATE POLICY social_connections_insert_own ON social_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY social_connections_update_own ON social_connections
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- User profiles policies
CREATE POLICY user_profiles_select_own ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY user_profiles_update_own ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Onboarding responses policies
CREATE POLICY onboarding_responses_select_own ON onboarding_responses
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY onboarding_responses_insert_own ON onboarding_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SEED DATA FOR MVP TESTING
-- ============================================================================

-- Sample Missions (25 total - 5 per category)
INSERT INTO missions (category, title_en, title_ar, description_en, description_ar, difficulty, xp_reward, lifescore_impact, coin_reward, product_spotlight) VALUES
-- Safe Driving Missions
('safe_driving', '7-Day Safe Driver Challenge', 'تحدي السائق الآمن لمدة 7 أيام', 'Complete 7 consecutive days of safe driving with no violations', 'أكمل 7 أيام متتالية من القيادة الآمنة بدون مخالفات', 'medium', 75, 15, 50, 'Motor Insurance'),
('safe_driving', 'Speed Limit Master', 'سيد حدود السرعة', 'Maintain speed limits for 5 consecutive trips', 'حافظ على حدود السرعة لـ 5 رحلات متتالية', 'easy', 40, 8, 25, 'Motor Insurance'),
('safe_driving', 'Defensive Driving Expert', 'خبير القيادة الدفاعية', 'Practice defensive driving techniques for 3 days', 'مارس تقنيات القيادة الدفاعية لمدة 3 أيام', 'hard', 100, 20, 75, 'Motor Insurance'),
('safe_driving', 'Night Driving Safety', 'سلامة القيادة الليلية', 'Complete 5 night drives with zero incidents', 'أكمل 5 قيادات ليلية بدون حوادث', 'medium', 60, 12, 40, 'Motor Insurance'),
('safe_driving', 'Eco-Friendly Commute', 'تنقل صديق للبيئة', 'Use eco-friendly driving habits for 1 week', 'استخدم عادات قيادة صديقة للبيئة لمدة أسبوع', 'easy', 35, 7, 20, 'Motor Insurance'),

-- Health Missions
('health', '10K Steps Daily', '10 آلاف خطوة يومياً', 'Walk 10,000 steps every day for 7 days', 'امش 10,000 خطوة كل يوم لمدة 7 أيام', 'medium', 70, 14, 45, 'Health Insurance'),
('health', 'Hydration Champion', 'بطل الترطيب', 'Drink 8 glasses of water daily for 5 days', 'اشرب 8 أكواب ماء يومياً لمدة 5 أيام', 'easy', 30, 6, 20, 'Health Insurance'),
('health', 'Sleep Quality Master', 'سيد جودة النوم', 'Maintain 7-8 hours of quality sleep for 1 week', 'حافظ على 7-8 ساعات نوم جيد لمدة أسبوع', 'medium', 65, 13, 40, 'Health Insurance'),
('health', 'Stress Management', 'إدارة الإجهاد', 'Practice stress-relief techniques for 5 days', 'مارس تقنيات تخفيف الإجهاد لمدة 5 أيام', 'hard', 90, 18, 60, 'Health Insurance'),
('health', 'Nutrition Tracker', 'متتبع التغذية', 'Log healthy meals for 7 consecutive days', 'سجل الوجبات الصحية لمدة 7 أيام متتالية', 'medium', 55, 11, 35, 'Health Insurance'),

-- Financial Guardian Missions
('financial_guardian', 'Budget Review Master', 'سيد مراجعة الميزانية', 'Review and optimize your monthly budget', 'راجع وحسن ميزانيتك الشهرية', 'medium', 80, 16, 50, 'Life Insurance'),
('financial_guardian', 'Emergency Fund Builder', 'باني صندوق الطوارئ', 'Set up emergency fund savings plan', 'أنشئ خطة ادخار صندوق الطوارئ', 'hard', 100, 20, 75, 'Life Insurance'),
('financial_guardian', 'Investment Research', 'بحث الاستثمار', 'Research and compare investment options', 'ابحث وقارن خيارات الاستثمار', 'hard', 85, 17, 60, 'Life Insurance'),
('financial_guardian', 'Debt Reduction Plan', 'خطة تقليل الديون', 'Create and follow debt reduction strategy', 'أنشئ واتبع استراتيجية تقليل الديون', 'medium', 70, 14, 45, 'Life Insurance'),
('financial_guardian', 'Financial Goal Setting', 'تحديد الأهداف المالية', 'Set and track 3 financial goals', 'حدد وتتبع 3 أهداف مالية', 'easy', 45, 9, 30, 'Life Insurance'),

-- Family Protection Missions
('family_protection', 'Family Safety Check', 'فحص سلامة العائلة', 'Conduct home safety assessment', 'قم بتقييم سلامة المنزل', 'medium', 60, 12, 40, 'Home Insurance'),
('family_protection', 'Emergency Contact Update', 'تحديث جهات الاتصال الطارئة', 'Update emergency contacts for all family members', 'حدث جهات الاتصال الطارئة لجميع أفراد العائلة', 'easy', 25, 5, 15, 'Home Insurance'),
('family_protection', 'Family Health Records', 'سجلات صحة العائلة', 'Organize family health records and documents', 'نظم سجلات ومستندات صحة العائلة', 'medium', 50, 10, 35, 'Health Insurance'),
('family_protection', 'Child Safety Education', 'تعليم سلامة الأطفال', 'Teach children about safety rules and procedures', 'علم الأطفال قواعد وإجراءات السلامة', 'easy', 35, 7, 25, 'Home Insurance'),
('family_protection', 'Family Emergency Plan', 'خطة طوارئ العائلة', 'Create comprehensive family emergency plan', 'أنشئ خطة طوارئ شاملة للعائلة', 'hard', 75, 15, 55, 'Home Insurance'),

-- Lifestyle Missions
('lifestyle', 'Digital Detox Challenge', 'تحدي إزالة السموم الرقمية', 'Reduce screen time by 50% for 3 days', 'قلل وقت الشاشة بنسبة 50% لمدة 3 أيام', 'medium', 55, 11, 35, 'Travel Insurance'),
('lifestyle', 'Learning New Skill', 'تعلم مهارة جديدة', 'Spend 1 hour daily learning a new skill', 'اقض ساعة يومياً في تعلم مهارة جديدة', 'hard', 80, 16, 55, 'Travel Insurance'),
('lifestyle', 'Community Service', 'خدمة المجتمع', 'Volunteer for community service for 4 hours', 'تطوع لخدمة المجتمع لمدة 4 ساعات', 'medium', 70, 14, 45, 'Travel Insurance'),
('lifestyle', 'Cultural Exploration', 'استكشاف ثقافي', 'Visit a cultural site or museum', 'زر موقعاً ثقافياً أو متحفاً', 'easy', 30, 6, 20, 'Travel Insurance'),
('lifestyle', 'Mindfulness Practice', 'ممارسة اليقظة', 'Practice mindfulness meditation for 5 days', 'مارس تأمل اليقظة لمدة 5 أيام', 'medium', 50, 10, 30, 'Travel Insurance');

-- Sample Rewards (10+ rewards)
INSERT INTO rewards (type, title_en, title_ar, description_en, description_ar, coins_cost, badge_icon, badge_rarity) VALUES
('badge', 'Bronze Achiever', 'المحقق البرونزي', 'Complete your first mission', 'أكمل مهمتك الأولى', 0, 'medal', 'common'),
('badge', 'Silver Streak Master', 'سيد السلسلة الفضي', 'Maintain a 7-day streak', 'حافظ على سلسلة لمدة 7 أيام', 0, 'trophy', 'rare'),
('badge', 'Gold LifeScore Champion', 'بطل النقاط الذهبي', 'Reach 80 LifeScore', 'وصل إلى 80 نقطة حياة', 0, 'crown', 'epic'),
('badge', 'Platinum Safety Expert', 'خبير السلامة البلاتيني', 'Complete all safe driving missions', 'أكمل جميع مهمات القيادة الآمنة', 0, 'shield', 'legendary'),
('coin_boost', 'Weekend Warrior', 'محارب نهاية الأسبوع', '2x coins for weekend missions', 'ضعف العملات لمهمات نهاية الأسبوع', 100, 'coins', 'common'),
('partner_offer', 'Fuel Discount', 'خصم الوقود', '10% discount on fuel purchases', 'خصم 10% على مشتريات الوقود', 200, 'gas-station', 'rare'),
('partner_offer', 'Gym Membership', 'عضوية الصالة الرياضية', '1 month free gym membership', 'عضوية صالة رياضية مجانية لمدة شهر', 500, 'dumbbell', 'epic'),
('partner_offer', 'Restaurant Voucher', 'قسيمة مطعم', 'QR 50 voucher for partner restaurants', 'قسيمة 50 ريال لمطاعم الشركاء', 150, 'restaurant', 'common'),
('streak_bonus', 'Daily Check-in', 'تسجيل دخول يومي', 'Bonus coins for daily app usage', 'عملات إضافية لاستخدام التطبيق يومياً', 0, 'calendar', 'common'),
('achievement', 'First Steps', 'الخطوات الأولى', 'Complete your first mission', 'أكمل مهمتك الأولى', 0, 'footprints', 'common');

-- Sample Achievements (10+ achievements)
INSERT INTO achievements (name_en, name_ar, description_en, description_ar, badge_icon, condition_type, condition_value, xp_reward, coin_reward, lifescore_boost, rarity) VALUES
('First Steps', 'الخطوات الأولى', 'Complete your first mission', 'أكمل مهمتك الأولى', 'footprints', 'missions_completed', 1, 50, 25, 5, 'common'),
('Streak Master', 'سيد السلسلة', 'Maintain a 7-day streak', 'حافظ على سلسلة لمدة 7 أيام', 'fire', 'streak_count', 7, 100, 50, 10, 'rare'),
('LifeScore Champion', 'بطل النقاط', 'Reach 80 LifeScore', 'وصل إلى 80 نقطة حياة', 'trophy', 'lifescore_milestone', 80, 150, 75, 15, 'epic'),
('Mission Marathon', 'ماراثون المهام', 'Complete 25 missions', 'أكمل 25 مهمة', 'medal', 'missions_completed', 25, 200, 100, 20, 'legendary'),
('XP Collector', 'جامع النقاط', 'Earn 1000 XP', 'احصل على 1000 نقطة خبرة', 'star', 'xp_milestone', 1000, 120, 60, 12, 'rare'),
('Coin Hoarder', 'جامع العملات', 'Accumulate 500 coins', 'اجمع 500 عملة', 'coins', 'coins_earned', 500, 80, 40, 8, 'common'),
('Active Explorer', 'المستكشف النشط', 'Be active for 30 days', 'كن نشطاً لمدة 30 يوماً', 'calendar', 'days_active', 30, 300, 150, 25, 'legendary'),
('Scenario Master', 'سيد السيناريوهات', 'Complete 10 scenario simulations', 'أكمل 10 محاكاة سيناريو', 'brain', 'scenarios_completed', 10, 100, 50, 10, 'rare'),
('Reward Redeemer', 'مسترد المكافآت', 'Redeem 5 rewards', 'استرد 5 مكافآت', 'gift', 'rewards_redeemed', 5, 60, 30, 6, 'common'),
('Safety Expert', 'خبير السلامة', 'Complete all safe driving missions', 'أكمل جميع مهمات القيادة الآمنة', 'shield', 'missions_completed', 5, 150, 75, 15, 'epic');

-- Sample Scenarios
INSERT INTO scenarios (title_en, title_ar, description_en, description_ar, category, input_params, ai_predictions) VALUES
('Career Change Impact', 'تأثير تغيير المهنة', 'Analyze the financial impact of changing careers', 'حلل التأثير المالي لتغيير المهنة', 'life_event', '{"current_salary": 50000, "new_salary": 60000, "transition_period": 6}', '{"risk_score": 0.3, "recommendations": ["build_emergency_fund", "update_insurance"]}'),
('Moving to New City', 'الانتقال إلى مدينة جديدة', 'Evaluate the lifestyle changes of relocating', 'قيم التغييرات في نمط الحياة عند الانتقال', 'lifestyle', '{"cost_of_living": "high", "job_opportunities": "good"}', '{"risk_score": 0.4, "recommendations": ["research_housing", "update_health_insurance"]}'),
('Starting a Family', 'بدء عائلة', 'Plan for the financial implications of having children', 'خطط للآثار المالية لإنجاب الأطفال', 'life_event', '{"current_age": 28, "planned_children": 2}', '{"risk_score": 0.2, "recommendations": ["life_insurance", "education_savings"]}'),
('Retirement Planning', 'تخطيط التقاعد', 'Optimize retirement savings strategy', 'حسن استراتيجية ادخار التقاعد', 'policy_change', '{"current_age": 35, "retirement_age": 65}', '{"risk_score": 0.1, "recommendations": ["increase_contributions", "diversify_portfolio"]}');

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user data with LifeScore (0-100 scale) and behavior tracking for Track 1 hackathon';
COMMENT ON TABLE user_behavior_events IS 'Critical AI analysis table - captures all user actions for personalization';
COMMENT ON TABLE lifescore_history IS 'LifeScore change tracking for analytics and AI trend analysis';
COMMENT ON TABLE ai_recommendations IS 'AI-generated personalized recommendations with confidence scoring';
COMMENT ON TABLE product_recommendations IS 'Cross-sell tracking for QIC products with conversion metrics';
COMMENT ON TABLE missions IS 'AI Personalized Missions for product discovery and engagement';
COMMENT ON TABLE mission_instances IS 'Mission resets for daily/weekly recurring missions';
COMMENT ON TABLE user_missions IS 'User progress tracking for missions with instance support';
COMMENT ON TABLE achievements IS 'Milestone badges for engagement with condition-based unlocking';
COMMENT ON TABLE user_achievements IS 'User earned achievements with notification tracking';
COMMENT ON TABLE notifications IS 'Push notification tracking for engagement';
COMMENT ON TABLE user_sessions IS 'Login pattern tracking for AI analysis';
COMMENT ON TABLE rewards IS 'Rewards Hub - coins to offers conversion';
COMMENT ON TABLE user_rewards IS 'User reward redemptions';
COMMENT ON TABLE scenarios IS 'Scenario Simulation - what-if AI projections';
COMMENT ON TABLE user_scenarios IS 'User scenario simulation results';
COMMENT ON TABLE social_connections IS 'Optional leaderboards and social proof';
COMMENT ON TABLE user_profiles IS 'User profiles with AI personality and behavior insights';
COMMENT ON TABLE onboarding_responses IS 'Quiz responses feeding into AI personalization engine';

-- ============================================================================
-- SCHEMA COMPLETION SUMMARY
-- ============================================================================

-- Total Tables Created: 19
-- New Tables: 11 (user_behavior_events, lifescore_history, ai_recommendations, product_recommendations, mission_instances, achievements, user_achievements, notifications, user_sessions)
-- Enhanced Tables: 3 (users, missions, user_profiles)
-- Existing Tables: 5 (rewards, user_rewards, scenarios, user_scenarios, social_connections, onboarding_responses)

-- RLS Policies: 19 tables with comprehensive security
-- Indexes: 50+ performance-optimized indexes
-- Triggers: 10+ for data integrity and tracking
-- Functions: 4 utility functions
-- Materialized Views: 2 for analytics
-- Sample Data: 25 missions, 10 rewards, 10 achievements, 4 scenarios

-- This schema provides a solid foundation for production-grade AI-powered gamification
-- while remaining flexible for future enhancements and supporting the complete
-- Track 1 hackathon engagement loop: Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity
