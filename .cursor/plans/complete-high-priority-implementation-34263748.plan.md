<!-- 34263748-aacb-4f3a-b902-b3f23a0639d2 0fd51786-52b2-4557-985a-c7a1182b10a0 -->
# QIC Life Intelligence Engine — Strategic Implementation Map

## Current State Analysis

### Existing Triggers & Events

- ✅ `user_behavior_events` table exists with comprehensive event tracking
- ✅ `mission_complete` events logged in `mission.service.js` (line 340)
- ✅ `mission_started` events logged in `mission.service.js` (line 218)
- ✅ `scenario_simulate` events logged in `scenario.service.js` (line 47)
- ✅ `login`/`logout` events can be tracked via session management
- ✅ `session_end` needs to be implemented (hook on logout or inactivity)

### Existing Rule-Based Logic (PRESERVE - DO NOT CHANGE)

- ✅ `matchPlansByScenario()` in `src/data/insurancePlans.ts` - strict category filtering
- ✅ `rerankByProfile()` in `src/data/insurancePlans.ts` - profile-based ranking
- ✅ `getDiscounts()` in `src/data/insurancePlans.ts` - profile-based discount calculation
- ✅ Default scenario buttons in `Showcase.tsx` - rule-based plan matching
- ✅ Bundle calculator - rule-based savings calculation
- ✅ Coin-to-discount conversion (100 coins = 1% off) - rule-based

### Existing AI API Calls (OPTIMIZE - ADD ONLY WHERE EFFICIENT)

- ✅ Mission generation (`generateMissions`, `generateDailyMissions`) - KEEP
- ✅ Mission steps generation (`generateMissionSteps`) - KEEP
- ✅ Scenario simulation (`simulateScenario`) - KEEP
- ✅ Plan detail generation (`generatePlanDetailContent`) - KEEP
- ✅ Daily brief generation - KEEP
- ⚠️ Some AI calls may be redundant - need to audit

### Integration Points

1. **Mission Completion** → `/missions/complete` endpoint → Add Intelligence Engine trigger
2. **Scenario Simulation** → `/ai/scenarios/simulate` endpoint → Add Intelligence Engine trigger
3. **Session End** → Need to implement → Add Intelligence Engine trigger
4. **Profile Update** → `/profile` endpoint → Add Intelligence Engine trigger (optional)

---

## Implementation Stages

### Stage 0: Database Schema (ai_state table)

**File:** `backend/schema.sql`

**Action:** Add `ai_state` table after existing tables (before RLS policies section)

```sql
-- AI State Table - Stores Intelligence Engine personalization state
CREATE TABLE IF NOT EXISTS ai_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_prompt TEXT,
    last_ai_response JSONB DEFAULT '{}',
    applied_changes JSONB DEFAULT '{}',
    source VARCHAR(20) DEFAULT 'rule' CHECK (source IN ('rule', 'ai', 'hybrid')),
    ai_confidence DECIMAL(3,2) DEFAULT 0.0 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- One active state per user
);

CREATE INDEX IF NOT EXISTS idx_ai_state_user ON ai_state(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_state_updated ON ai_state(updated_at DESC);

ALTER TABLE ai_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_state_select_own ON ai_state
    FOR SELECT USING (COALESCE(current_user_uuid(), auth.uid()) = user_id);
CREATE POLICY ai_state_insert_own ON ai_state
    FOR INSERT WITH CHECK (COALESCE(current_user_uuid(), auth.uid()) = user_id);
CREATE POLICY ai_state_update_own ON ai_state
    FOR UPDATE USING (COALESCE(current_user_uuid(), auth.uid()) = user_id);
```

**Test:** Migration script validates table creation and indexes

---

### Stage 1: Intelligence Service (Core Engine)

**File:** `backend/services/intelligence.service.js` (NEW)

**Purpose:** Self-contained service that:

- Fetches user context from Supabase
- Applies rule-based personalization
- Optionally calls AI API when conditions met
- Stores results in `ai_state`

**Key Methods:**

1. `personalize(userId, trigger, context)` - Main entry point
2. `_fetchUserContext(userId)` - Gets user data, activity, last ai_state
3. `_applyRules(context)` - Rule-based personalization (deterministic)
4. `_shouldUseAI(context)` - Determines if AI call is needed
5. `_callAIPersonalization(context)` - AI API integration
6. `_storeState(userId, result)` - Persists to ai_state table

**Rule-Based Logic (Preserve Existing Patterns):**

```javascript
_applyRules(context) {
  const { user, activity, lastState } = context;
  const changes = {
    missions: [],
    ui_prompts: [],
    cross_sell: [],
    lifescore_weights: {},
    coins_delta: 0,
    explain: ''
  };

  // Rule 1: Coins banner (if coins >= 500 && not shown recently)
  if (user.coins >= 500) {
    const lastShown = lastState?.applied_changes?.ui_prompts?.includes('show_rewards_banner');
    const daysSinceShown = lastShown ? daysDiff(lastState.updated_at) : 999;
    if (daysSinceShown >= 3) {
      changes.ui_prompts.push('show_rewards_banner');
      changes.explain += 'High coins balance; showing rewards banner. ';
    }
  }

  // Rule 2: Cross-sell bundle (if explored 2+ product categories)
  const categories = new Set(activity.filter(e => e.event_type === 'plan_explore')
    .map(e => e.event_data?.product_category).filter(Boolean));
  if (categories.size >= 2) {
    changes.cross_sell.push({
      type: 'bundle_suggest',
      products: Array.from(categories),
      reason: 'Multiple categories explored'
    });
    changes.explain += 'Multi-category interest detected; suggesting bundle. ';
  }

  // Rule 3: Re-engagement (if inactive 7+ days)
  const lastActive = activity[0]?.created_at || user.last_active_at;
  const daysInactive = daysDiff(lastActive);
  if (daysInactive >= 7) {
    changes.missions.push({
      id: `reengage_${Date.now()}`,
      title: 'Welcome Back!',
      difficulty: 'easy',
      reward_coins: 20,
      lifescore_impact: 2,
      reason: 'Re-engagement mission for inactive user'
    });
    changes.explain += 'User inactive 7+ days; generating re-engagement mission. ';
  }

  // Rule 4: Mission escalation (if missed 3 consecutive missions)
  const recentMissed = activity.filter(e => 
    e.event_type === 'mission_fail' || 
    (e.event_type === 'mission_start' && !activity.find(a => 
      a.event_type === 'mission_complete' && 
      a.event_data?.mission_id === e.event_data?.mission_id &&
      a.created_at > e.created_at
    ))
  ).slice(0, 3);
  if (recentMissed.length >= 3) {
    changes.missions.push({
      id: `easy_${Date.now()}`,
      title: 'Easy Win Mission',
      difficulty: 'easy',
      reward_coins: 15,
      lifescore_impact: 3,
      reason: 'Mission fatigue detected; offering easier mission with higher reward'
    });
    changes.explain += 'Mission fatigue detected; offering easier mission. ';
  }

  // Rule 5: LifeScore drop (if fell 5+ in 14 days)
  const lifescoreHistory = context.lifescoreHistory || [];
  const recentDrop = lifescoreHistory.find(h => 
    daysDiff(h.created_at) <= 14 && 
    h.change_amount <= -5
  );
  if (recentDrop) {
    changes.ui_prompts.push({
      id: 'lifescore_educational',
      type: 'banner',
      priority: 2,
      text: 'Your LifeScore dropped. Complete a mission to boost it!',
      cta: 'open_missions'
    });
    changes.explain += 'LifeScore drop detected; showing educational prompt. ';
  }

  return {
    applied_changes: changes,
    metadata: { source: 'rule', ai_confidence: 0.0 }
  };
}
```

**AI Integration (Progressive Replacement):**

```javascript
_shouldUseAI(context) {
  const { user, activity, lastState } = context;
  
  // Condition 1: High-activity users (≥5 events/day average)
  const last7DaysActivity = activity.filter(a => daysDiff(a.created_at) <= 7);
  const avgEventsPerDay = last7DaysActivity.length / 7;
  if (avgEventsPerDay >= 5) return true;

  // Condition 2: Manual admin trigger (via context flag)
  if (context.forceAI === true) return true;

  // Condition 3: Weekly scheduled refresh (if last AI call was 7+ days ago)
  const lastAICall = lastState?.updated_at;
  if (lastAICall && daysDiff(lastAICall) >= 7 && lastState?.source === 'ai') return true;

  // Condition 4: Mission fatigue or LifeScore stagnation
  const completedMissions = activity.filter(e => e.event_type === 'mission_complete').length;
  const startedMissions = activity.filter(e => e.event_type === 'mission_start').length;
  const completionRate = startedMissions > 0 ? completedMissions / startedMissions : 1;
  if (completionRate < 0.5 && startedMissions >= 3) return true; // Mission fatigue

  const lifescoreStagnant = context.lifescoreHistory?.slice(0, 14)
    .every(h => Math.abs(h.change_amount) < 2);
  if (lifescoreStagnant && daysDiff(activity[0]?.created_at) <= 14) return true;

  return false; // Default: use rules
}
```

**AI Prompt Structure:**

```javascript

_buildAIPrompt(context) {

const { user, activity, profile } = context;

// Anonymize PII - use pseudonymous data only

const userSummary = {

id: user.id.slice(0, 8) + '...', // Pseudonymous

age: user.age,

nationality: user.nationality,

preferences: profile?.preferences || [],

coins: user.coins,

lifescore: user.lifescore,

level: user.level

};

const recentActivity = activity.slice(0, 30).map(e => ({

event_type: e.event_type,

category: e.event_data?.category || e.event_data?.product_category,

created_at: e.created_at

}));

return {

system: "You are QIC Life's Adaptive Personalization Engine. Output JSON matching RESPONSE_SCHEMA only. Be concise and actionable.",

input: {

user_summary: userSummary,

recent_activity: recentActivity,

goals: {

primary: "increase_daily_visits",