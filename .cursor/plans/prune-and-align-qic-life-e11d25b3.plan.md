<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 b3ee715b-c6b9-4fe1-b997-09b369ed597c -->
# Production-Ready Supabase PostgreSQL Schema for QIC Life Track 1

## Overview

Design a comprehensive, production-grade database schema supporting the AI-powered engagement loop: **Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity**. The schema must track user behavior, support AI personalization, ensure data security with RLS policies, and optimize for performance.

## Key Requirements Analysis

### Current State Issues

1. **Missing behavior tracking** - No dedicated table for user actions/events
2. **Limited AI context** - Behavior data not structured for AI analysis
3. **No RLS policies** - Security not production-ready
4. **Missing audit trails** - No change history tracking
5. **Typo in schema** - `BOOAN` instead of `BOOLEAN` in missions table
6. **Missing notification system** - No push notification tracking
7. **No LifeScore history** - Can't track score changes over time
8. **Missing product recommendations** - No cross-sell tracking table

## Phase 1: Core Tables Enhancement

### 1.1 Users Table - Enhanced Behavior Tracking

**Add missing fields:**

- `username` VARCHAR(50) UNIQUE - for social features
- `phone_number` VARCHAR(20) - for notifications
- `last_active_at` TIMESTAMP - for engagement tracking
- `longest_streak` INTEGER - gamification metric
- `timezone` VARCHAR(50) DEFAULT 'Asia/Qatar'
- `notification_preferences` JSONB - push notification settings

### 1.2 User Behavior Events Table (NEW)

**Critical for AI analysis - captures all user actions:**

```sql
CREATE TABLE user_behavior_events (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) -- 'mission_start', 'mission_complete', 'reward_redeem', 'login', 'scenario_simulate'
    event_data JSONB -- flexible event context
    lifescore_before INTEGER
    lifescore_after INTEGER
    created_at TIMESTAMP
)
```

**Purpose:** Feed AI engine with behavioral patterns for personalization

### 1.3 LifeScore History Table (NEW)

**Track LifeScore changes over time:**

```sql
CREATE TABLE lifescore_history (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    old_score INTEGER,
    new_score INTEGER,
    change_reason VARCHAR(100), -- 'mission_complete', 'scenario_penalty', 'streak_bonus'
    mission_id UUID REFERENCES missions(id), -- optional foreign key
    created_at TIMESTAMP
)
```

**Purpose:** Analytics, AI trend analysis, user insights dashboard

## Phase 2: AI & Personalization Tables

### 2.1 AI Recommendations Table (NEW)

**Store AI-generated personalized recommendations:**

```sql
CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    recommendation_type VARCHAR(50), -- 'mission', 'product', 'scenario'
    target_id UUID, -- mission_id or product_id
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    reasoning TEXT, -- AI explanation
    status VARCHAR(20), -- 'pending', 'accepted', 'dismissed'
    expires_at TIMESTAMP,
    created_at TIMESTAMP
)
```

**Purpose:** Track AI recommendation effectiveness, improve algorithms

### 2.2 Product Recommendations Table (NEW)

**Cross-sell tracking for QIC products:**

```sql
CREATE TABLE product_recommendations (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    product_type VARCHAR(50), -- 'motor_insurance', 'health_insurance', 'life_insurance'
    product_name VARCHAR(255),
    recommended_by VARCHAR(20), -- 'ai', 'mission_complete', 'lifescore_milestone'
    priority INTEGER, -- 1-5
    status VARCHAR(20), -- 'recommended', 'viewed', 'purchased', 'dismissed'
    metadata JSONB, -- product details, pricing
    created_at TIMESTAMP,
    viewed_at TIMESTAMP,
    actioned_at TIMESTAMP
)
```

**Purpose:** Track cross-sell success, measure conversion from engagement

### 2.3 Enhanced User Profiles

**Add AI-specific fields:**

- `ai_personality_type` VARCHAR(50) - 'encouraging', 'competitive', 'educational'
- `last_ai_analysis_at` TIMESTAMP
- `behavior_summary` JSONB - AI-generated behavior insights

## Phase 3: Gamification Enhancements

### 3.1 Missions Table - Fix Typo & Add Fields

**Fix:** `is_active BOOAN` → `is_active BOOLEAN`

**Add fields:**

- `recurrence_type` VARCHAR(20) - 'daily', 'weekly', 'one_time'
- `next_available_at` TIMESTAMP - for daily/weekly missions
- `ai_generated` BOOLEAN DEFAULT FALSE - track AI-created missions
- `coin_reward` INTEGER DEFAULT 0 - reward coins alongside XP
- `product_spotlight` VARCHAR(255) - which QIC product this promotes

### 3.2 Daily/Weekly Mission Instances Table (NEW)

**Track mission resets for recurring missions:**

```sql
CREATE TABLE mission_instances (
    id UUID PRIMARY KEY,
    mission_id UUID REFERENCES missions(id),
    instance_date DATE,
    available_from TIMESTAMP,
    available_until TIMESTAMP,
    is_expired BOOLEAN DEFAULT FALSE
)
```

### 3.3 Achievements Table (NEW)

**Milestone badges for engagement:**

```sql
CREATE TABLE achievements (
    id UUID PRIMARY KEY,
    name_en VARCHAR(255),
    name_ar VARCHAR(255),
    description_en TEXT,
    description_ar TEXT,
    badge_icon VARCHAR(100),
    condition_type VARCHAR(50), -- 'lifescore_milestone', 'streak_count', 'missions_completed'
    condition_value INTEGER,
    is_active BOOLEAN
)

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    achievement_id UUID REFERENCES achievements(id),
    earned_at TIMESTAMP,
    UNIQUE(user_id, achievement_id)
)
```

## Phase 4: Notification & Engagement

### 4.1 Notifications Table (NEW)

**Push notification tracking:**

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50), -- 'mission_reminder', 'reward_available', 'streak_reminder', 'lifescore_update'
    title VARCHAR(255),
    message TEXT,
    action_url VARCHAR(500),
    priority VARCHAR(20), -- 'high', 'medium', 'low'
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### 4.2 User Sessions Table (NEW)

**Track login patterns for AI:**

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    session_token VARCHAR(255) UNIQUE,
    device_info JSONB, -- browser, OS, app version
    ip_address VARCHAR(45),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER
)
```

## Phase 5: Row-Level Security (RLS) Policies

### 5.1 Users Table RLS

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY users_select_own ON users
    FOR SELECT USING (auth.uid() = id);
    
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (auth.uid() = id);
```

### 5.2 Missions Table RLS

```sql
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

-- All users can read active missions
CREATE POLICY missions_select_all ON missions
    FOR SELECT USING (is_active = TRUE);
    
-- Only admins can insert/update missions
CREATE POLICY missions_admin_all ON missions
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

### 5.3 User Missions Table RLS

```sql
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own mission progress
CREATE POLICY user_missions_select_own ON user_missions
    FOR SELECT USING (auth.uid() = user_id);
    
CREATE POLICY user_missions_insert_own ON user_missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
CREATE POLICY user_missions_update_own ON user_missions
    FOR UPDATE USING (auth.uid() = user_id);
```

### 5.4 Similar RLS for All User-Specific Tables

Apply similar policies to:

- `user_behavior_events`
- `lifescore_history`
- `ai_recommendations`
- `product_recommendations`
- `user_profiles`
- `user_rewards`
- `user_scenarios`
- `user_achievements`
- `notifications`
- `user_sessions`

## Phase 6: Performance Optimization

### 6.1 Additional Critical Indexes

```sql
-- User behavior analysis
CREATE INDEX idx_behavior_events_user_type ON user_behavior_events(user_id, event_type);
CREATE INDEX idx_behavior_events_created ON user_behavior_events(created_at DESC);

-- LifeScore trending
CREATE INDEX idx_lifescore_history_user ON lifescore_history(user_id, created_at DESC);

-- AI recommendations
CREATE INDEX idx_ai_recs_user_status ON ai_recommendations(user_id, status);
CREATE INDEX idx_ai_recs_expires ON ai_recommendations(expires_at) WHERE status = 'pending';

-- Product recommendations
CREATE INDEX idx_product_recs_user_status ON product_recommendations(user_id, status);
CREATE INDEX idx_product_recs_priority ON product_recommendations(priority DESC);

-- Notifications
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_sent ON notifications(sent_at DESC);

-- User sessions (for engagement analysis)
CREATE INDEX idx_sessions_user_started ON user_sessions(user_id, started_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_user_missions_status_started ON user_missions(user_id, status, started_at DESC);
CREATE INDEX idx_missions_category_difficulty ON missions(category, difficulty, is_active);
```

### 6.2 Materialized Views for Analytics

```sql
-- User engagement summary
CREATE MATERIALIZED VIEW user_engagement_summary AS
SELECT 
    user_id,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    COUNT(*) as total_events,
    MAX(created_at) as last_activity
FROM user_behavior_events
GROUP BY user_id;

CREATE INDEX idx_engagement_summary_user ON user_engagement_summary(user_id);

-- Refresh strategy: hourly via cron job
```

## Phase 7: Data Integrity & Constraints

### 7.1 Foreign Key Constraints

**All already defined but verify:**

- Cascade deletes on user deletion
- Restrict deletes on missions/rewards while in use

### 7.2 Check Constraints

**Additional validations:**

```sql
-- User missions progress validation
ALTER TABLE user_missions ADD CONSTRAINT check_progress_complete 
    CHECK (status != 'completed' OR progress = 100);

-- LifeScore change reasonableness
ALTER TABLE lifescore_history ADD CONSTRAINT check_score_change_reasonable
    CHECK (ABS(new_score - old_score) <= 50);

-- AI confidence score range
ALTER TABLE ai_recommendations ADD CONSTRAINT check_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1);
```

## Phase 8: Functions & Triggers

### 8.1 LifeScore Update Trigger

```sql
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

CREATE TRIGGER trigger_track_lifescore_change
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.lifescore IS DISTINCT FROM NEW.lifescore)
    EXECUTE FUNCTION track_lifescore_change();
```

### 8.2 Auto-expire Old Recommendations

```sql
CREATE OR REPLACE FUNCTION expire_old_recommendations()
RETURNS void AS $$
BEGIN
    UPDATE ai_recommendations
    SET status = 'expired'
    WHERE expires_at < NOW() AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Call via cron job every hour
```

## Phase 9: Seed Data for MVP

### 9.1 Sample Missions (5 per category)

- Safe Driving: "7-Day Safe Driver", "Speed Limit Challenge", etc.
- Health: "10K Steps Daily", "Hydration Tracker", etc.
- Financial: "Budget Review", "Emergency Fund Setup", etc.

### 9.2 Sample Rewards

- Badges: Bronze/Silver/Gold/Platinum
- Partner Offers: Fuel discounts, gym memberships, restaurant vouchers
- Coin Boosts: 2x coins for weekend missions

### 9.3 Sample Achievements

- "First Steps" (Complete first mission)
- "Streak Master" (7-day streak)
- "LifeScore Champion" (Reach 80 LifeScore)

## Summary of Changes

**New Tables:** 11

- `user_behavior_events`
- `lifescore_history`
- `ai_recommendations`
- `product_recommendations`
- `mission_instances`
- `achievements`
- `user_achievements`
- `notifications`
- `user_sessions`

**Enhanced Tables:** 3

- `users` (+7 fields)
- `missions` (+5 fields, fix typo)
- `user_profiles` (+3 fields)

**RLS Policies:** 12+ tables

**New Indexes:** 15+

**Triggers:** 2

**Functions:** 3

**Materialized Views:** 1

## Implementation Order

1. Fix typo in missions table
2. Add fields to existing tables (users, missions, user_profiles)
3. Create behavior tracking tables
4. Create AI recommendation tables
5. Create gamification tables (achievements, notifications)
6. Implement RLS policies
7. Add performance indexes
8. Create triggers and functions
9. Seed sample data
10. Test with mock AI integrations

This schema provides a solid foundation for production-grade AI-powered gamification while remaining flexible for future enhancements.

### To-dos

- [ ] Delete Skill Tree page and remove from navigation and API client
- [ ] Delete Skill Tree route, remove from server, clean validation and database service
- [ ] Remove skill_trees and user_skills tables from all schema files
- [ ] Change LifeScore from 0-1000 to 0-100 scale across codebase
- [ ] Update README and PROJECT_STRUCTURE to reflect Track 1 hackathon alignment
- [ ] Verify all core features (LifeScore, Missions, Scenarios, Rewards, Social) align with brief