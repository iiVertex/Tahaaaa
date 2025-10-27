# QIC Life Track 1 - Production Database Schema Documentation

## Overview

This document describes the comprehensive production-ready Supabase PostgreSQL schema for QIC Life Track 1 hackathon, supporting the AI-powered engagement loop: **Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity**.

## Schema Architecture

### Core Engagement Loop Tables

1. **User Behavior Tracking**
   - `users` - Enhanced user profiles with behavior metrics
   - `user_behavior_events` - Captures all user actions for AI analysis
   - `lifescore_history` - Tracks LifeScore changes over time
   - `user_sessions` - Login patterns and device tracking

2. **AI Personalization**
   - `ai_recommendations` - AI-generated personalized recommendations
   - `product_recommendations` - Cross-sell tracking for QIC products
   - `user_profiles` - Enhanced with AI personality and behavior insights

3. **Gamification System**
   - `missions` - AI Personalized Missions with product spotlight
   - `mission_instances` - Daily/weekly mission resets
   - `user_missions` - User progress tracking
   - `achievements` - Milestone badges with condition-based unlocking
   - `user_achievements` - Earned achievements tracking

4. **Rewards & Engagement**
   - `rewards` - Rewards Hub (coins → offers conversion)
   - `user_rewards` - Reward redemptions
   - `notifications` - Push notification tracking
   - `scenarios` - Scenario Simulation (what-if AI projections)
   - `user_scenarios` - User scenario results

5. **Social Features**
   - `social_connections` - Optional leaderboards and social proof
   - `onboarding_responses` - Quiz data for AI personalization

## Key Features

### 1. AI-Powered Behavior Analysis

The schema captures comprehensive user behavior through the `user_behavior_events` table:

```sql
-- Event types tracked:
'mission_start', 'mission_complete', 'mission_fail', 'reward_redeem', 
'login', 'logout', 'scenario_simulate', 'profile_update', 'achievement_earn',
'notification_open', 'app_open', 'streak_milestone', 'lifescore_milestone'
```

**Purpose:** Feed AI engine with behavioral patterns for personalization and recommendation generation.

### 2. LifeScore Engine (0-100 Scale)

The LifeScore system tracks user engagement and provides a dynamic metric:

- **Range:** 0-100 (changed from 0-1000 for better UX)
- **Tracking:** All changes logged in `lifescore_history`
- **Triggers:** Automatic tracking via database triggers
- **Impact Sources:** Missions, scenarios, achievements, streaks

### 3. AI Recommendation System

Two-tier recommendation system:

#### AI Recommendations (`ai_recommendations`)
- **Types:** mission, product, scenario, achievement
- **Confidence Scoring:** 0.00 to 1.00
- **Status Tracking:** pending, accepted, dismissed, expired
- **Auto-expiration:** 7-day default expiry

#### Product Recommendations (`product_recommendations`)
- **Cross-sell Focus:** QIC insurance products
- **Priority System:** 1-5 priority levels
- **Conversion Tracking:** recommended → viewed → interested → purchased
- **Metadata:** Product details, pricing, discounts

### 4. Mission System Enhancement

#### Recurring Missions
- **Types:** daily, weekly, one_time
- **Instances:** `mission_instances` table tracks resets
- **Availability:** Time-based availability windows

#### Product Integration
- **Product Spotlight:** Each mission promotes specific QIC products
- **AI Generated:** Track AI-created vs. manual missions
- **Coin Rewards:** Additional currency alongside XP

### 5. Achievement System

Condition-based achievement unlocking:

```sql
-- Condition types:
'lifescore_milestone', 'streak_count', 'missions_completed', 'xp_milestone',
'coins_earned', 'days_active', 'scenarios_completed', 'rewards_redeemed'
```

**Features:**
- Automatic unlocking based on user progress
- Rarity system: common, rare, epic, legendary
- XP and coin rewards
- LifeScore boosts

### 6. Notification System

Comprehensive notification tracking:

```sql
-- Notification types:
'mission_reminder', 'reward_available', 'streak_reminder', 'lifescore_update',
'achievement_earned', 'product_recommendation', 'daily_challenge', 'weekly_summary'
```

**Features:**
- Priority levels: high, medium, low
- Read/unread tracking
- Action URLs for deep linking
- Sent/read timestamps

## Performance Optimization

### Indexes (50+ total)

**Critical Performance Indexes:**
- User behavior analysis: `idx_behavior_events_user_type`
- LifeScore trending: `idx_lifescore_history_user`
- AI recommendations: `idx_ai_recs_user_status`, `idx_ai_recs_expires`
- Product recommendations: `idx_product_recs_user_status`, `idx_product_recs_priority`
- Notifications: `idx_notifications_user_read`
- User sessions: `idx_sessions_user_started`

**Composite Indexes:**
- `idx_user_missions_status_started` - Mission progress queries
- `idx_missions_category_difficulty` - Mission filtering

### Materialized Views

**User Engagement Summary:**
```sql
CREATE MATERIALIZED VIEW user_engagement_summary AS
SELECT 
    user_id,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    COUNT(*) as total_events,
    MAX(created_at) as last_activity,
    COUNT(DISTINCT event_type) as unique_event_types
FROM user_behavior_events
GROUP BY user_id;
```

**User Mission Stats:**
```sql
CREATE MATERIALIZED VIEW user_mission_stats AS
SELECT 
    user_id,
    COUNT(*) as total_missions_started,
    COUNT(*) FILTER (WHERE status = 'completed') as missions_completed,
    ROUND(COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / 
          NULLIF(COUNT(*), 0) * 100, 2) as completion_rate,
    SUM(xp_earned) as total_xp_earned,
    SUM(lifescore_change) as total_lifescore_change
FROM user_missions
GROUP BY user_id;
```

## Security (Row-Level Security)

### RLS Policies Implemented

**User-Specific Tables:** Users can only access their own data
- `users`, `user_behavior_events`, `lifescore_history`
- `ai_recommendations`, `product_recommendations`
- `user_missions`, `user_achievements`, `user_rewards`
- `user_scenarios`, `user_profiles`, `onboarding_responses`
- `notifications`, `user_sessions`

**Public Tables:** All users can read active content
- `missions` (active only)
- `achievements` (active only)
- `rewards` (active only)
- `scenarios` (active only)

**Admin-Only Tables:** Only admins can modify
- `missions` (insert/update/delete)
- `achievements` (insert/update/delete)
- `rewards` (insert/update/delete)

## Data Integrity

### Constraints

**Check Constraints:**
- LifeScore range: 0-100
- XP non-negative
- Progress completion: 100% when completed
- LifeScore change reasonableness: ±50 max
- AI confidence score: 0.00-1.00

**Foreign Key Constraints:**
- Cascade deletes on user deletion
- Restrict deletes on missions/rewards while in use

### Triggers

**LifeScore Change Tracking:**
```sql
CREATE TRIGGER trigger_track_lifescore_change
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.lifescore IS DISTINCT FROM NEW.lifescore)
    EXECUTE FUNCTION track_lifescore_change();
```

**Auto-Updated Timestamps:**
All tables with `updated_at` fields have automatic timestamp triggers.

## Functions

### Utility Functions

1. **`update_updated_at()`** - Updates timestamp on record changes
2. **`track_lifescore_change()`** - Logs LifeScore changes to history
3. **`expire_old_recommendations()`** - Auto-expires old AI recommendations
4. **`refresh_analytics_views()`** - Refreshes materialized views

## Sample Data

### Missions (25 total - 5 per category)

**Safe Driving:**
- 7-Day Safe Driver Challenge
- Speed Limit Master
- Defensive Driving Expert
- Night Driving Safety
- Eco-Friendly Commute

**Health:**
- 10K Steps Daily
- Hydration Champion
- Sleep Quality Master
- Stress Management
- Nutrition Tracker

**Financial Guardian:**
- Budget Review Master
- Emergency Fund Builder
- Investment Research
- Debt Reduction Plan
- Financial Goal Setting

**Family Protection:**
- Family Safety Check
- Emergency Contact Update
- Family Health Records
- Child Safety Education
- Family Emergency Plan

**Lifestyle:**
- Digital Detox Challenge
- Learning New Skill
- Community Service
- Cultural Exploration
- Mindfulness Practice

### Rewards (10+ total)

**Badges:** Bronze Achiever, Silver Streak Master, Gold LifeScore Champion, Platinum Safety Expert
**Partner Offers:** Fuel Discount, Gym Membership, Restaurant Voucher
**Coin Boosts:** Weekend Warrior, Daily Check-in

### Achievements (10+ total)

**Milestones:** First Steps, Streak Master, LifeScore Champion, Mission Marathon
**Collectors:** XP Collector, Coin Hoarder, Active Explorer
**Specialists:** Scenario Master, Reward Redeemer, Safety Expert

## Engagement Loop Flow

### Complete Flow Example

1. **Behavior Tracking**
   ```sql
   INSERT INTO user_behavior_events (user_id, event_type, event_data)
   VALUES (user_id, 'login', '{"login_method": "email"}');
   ```

2. **AI Analysis**
   ```sql
   INSERT INTO ai_recommendations (user_id, recommendation_type, confidence_score)
   VALUES (user_id, 'mission', 0.85);
   ```

3. **Mission Completion**
   ```sql
   UPDATE user_missions SET status = 'completed', progress = 100;
   UPDATE users SET lifescore = lifescore + 15, xp = xp + 75;
   ```

4. **LifeScore Tracking**
   ```sql
   -- Automatic via trigger
   INSERT INTO lifescore_history (user_id, old_score, new_score, change_reason)
   VALUES (user_id, 25, 40, 'mission_complete');
   ```

5. **Achievement Unlocking**
   ```sql
   INSERT INTO user_achievements (user_id, achievement_id)
   VALUES (user_id, achievement_id);
   ```

6. **Reward Redemption**
   ```sql
   INSERT INTO user_rewards (user_id, reward_id)
   VALUES (user_id, reward_id);
   ```

7. **Cross-sell Opportunity**
   ```sql
   INSERT INTO product_recommendations (user_id, product_type, recommended_by)
   VALUES (user_id, 'motor_insurance', 'mission_complete');
   ```

8. **Notification**
   ```sql
   INSERT INTO notifications (user_id, type, title, message)
   VALUES (user_id, 'achievement_earned', 'Achievement Unlocked!', 'You earned the First Steps achievement!');
   ```

## Testing

### Integration Test

The `test-schema-integration.sql` file provides comprehensive testing:

1. **Data Setup** - Creates test user and related data
2. **Behavior Tracking** - Tests event logging
3. **AI Recommendations** - Tests recommendation generation
4. **Mission Flow** - Tests complete mission lifecycle
5. **Achievement System** - Tests achievement unlocking
6. **Reward System** - Tests reward redemption
7. **Scenario Simulation** - Tests AI scenario predictions
8. **Notification System** - Tests notification creation
9. **Performance Verification** - Tests index usage
10. **RLS Verification** - Tests security policies
11. **Trigger Testing** - Tests automatic functions
12. **Complete Loop Verification** - Tests entire engagement loop

### Verification Queries

The test includes verification queries for:
- Table structure
- Index existence
- Trigger functionality
- Function availability
- RLS policy enforcement
- Materialized view data

## Deployment

### Production Considerations

1. **Environment Variables**
   - `SUPABASE_URL` - Database connection URL
   - `SUPABASE_SERVICE_KEY` - Service role key for admin operations
   - `USE_SUPABASE` - Flag to enable/disable Supabase

2. **Cron Jobs**
   - Hourly: `expire_old_recommendations()`
   - Hourly: `refresh_analytics_views()`

3. **Monitoring**
   - Track materialized view refresh times
   - Monitor RLS policy performance
   - Watch for trigger execution errors

4. **Backup Strategy**
   - Regular automated backups
   - Point-in-time recovery capability
   - Cross-region replication for disaster recovery

## Summary

This production-ready schema provides:

- **19 Tables** (11 new, 3 enhanced, 5 existing)
- **50+ Indexes** for optimal performance
- **19 RLS Policies** for security
- **10+ Triggers** for data integrity
- **4 Functions** for automation
- **2 Materialized Views** for analytics
- **Complete Engagement Loop** support
- **AI Integration** ready
- **Scalable Architecture** for growth

The schema fully supports the Track 1 hackathon requirements and provides a solid foundation for production deployment with comprehensive AI-powered gamification features.
