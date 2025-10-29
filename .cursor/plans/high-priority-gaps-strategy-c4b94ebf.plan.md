<!-- c4b94ebf-fe56-4e4e-b55f-0585f9fb637e 4336d90e-5e24-4894-9798-192a60652559 -->
# High Priority Gaps: Implementation & Testing Strategy

## Overview

Address 4 critical high-priority gaps to complete core functionality: analytics persistence, quote database storage, behavior summary queries, and achievement auto-checking. Each gap will be implemented with comprehensive testing and validation.

---

## Gap 1: Analytics Persistence (Backend)

### Problem

`backend/repositories/analytics.repo.js` - `insertBehaviorEvent()` uses placeholder logic instead of writing to Supabase database.

### Solution

Implement real Supabase database writes for analytics events.

**File: `backend/repositories/analytics.repo.js`**

Update `insertBehaviorEvent()`:

```javascript
async insertBehaviorEvent(event) {
  if (!this.db || !this.db.from) return; // Guard for mock mode
  try {
    const { error } = await this.db
      .from('user_behavior_events')
      .insert({
        user_id: event.user_id,
        event_type: event.event_type,
        event_data: event.event_data || {},
        lifescore_before: event.lifescore_before,
        lifescore_after: event.lifescore_after,
        session_id: event.session_id,
        device_info: event.device_info || {}
      });
    if (error) throw error;
  } catch (err) {
    // Fail silently to not break user flow
  }
}
```

Update `getBehaviorSummary()`:

```javascript
async getBehaviorSummary(userId) {
  if (!this.db || !this.db.from) {
    return { user_id: userId, last7_days_events: 0, mission_completions: 0, streak_days: 0, lifescore_trend: 'flat' };
  }
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await this.db
      .from('user_behavior_events')
      .select('event_type, lifescore_before, lifescore_after')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    const missionCompletions = events.filter(e => e.event_type === 'mission_complete').length;
    const lifescoreTrend = this.calculateTrend(events);
    
    return {
      user_id: userId,
      last7_days_events: events.length,
      mission_completions: missionCompletions,
      streak_days: 0, // Will be calculated from user table
      lifescore_trend: lifescoreTrend
    };
  } catch (err) {
    return { user_id: userId, last7_days_events: 0, mission_completions: 0, streak_days: 0, lifescore_trend: 'flat' };
  }
}

calculateTrend(events) {
  if (events.length < 2) return 'flat';
  const withBefore = events.filter(e => e.lifescore_before != null && e.lifescore_after != null);
  if (withBefore.length === 0) return 'flat';
  const first = withBefore[0].lifescore_before;
  const last = withBefore[withBefore.length - 1].lifescore_after;
  const delta = last - first;
  if (delta > 2) return 'up';
  if (delta < -2) return 'down';
  return 'flat';
}
```

Update `getRecentEvents()`:

```javascript
async getRecentEvents(userId, limit = 20) {
  if (!this.db || !this.db.from) return [];
  try {
    const { data, error } = await this.db
      .from('user_behavior_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
}
```

### Testing

1. Create test script `backend/test/analytics.test.js`
2. Test event insertion with various event types
3. Verify behavior summary calculation
4. Test trend calculation (up/down/flat)
5. Verify recent events retrieval and ordering
6. Test error handling with invalid data

---

## Gap 2: Quote Database Storage (Backend)

### Problem

`backend/routes/quotes.js` uses in-memory Map instead of database persistence.

### Solution

Replace Map with Supabase database operations.

**File: `backend/routes/quotes.js`**

Remove `const quotes = new Map();` at top of file.

Update `/start` endpoint:

```javascript
router.post('/start', authenticateUser, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { product_id, inputs } = req.body || {};
  if (!product_id) return res.status(400).json({ success: false, message: 'product_id required' });

  // Validate product and eligibility (keep existing logic)
  const productService = container.services.product;
  const catalog = productService.getCatalog();
  const product = catalog.find(p => p.id === product_id);
  if (!product) return res.status(400).json({ success: false, message: 'Invalid product_id' });
  const eligibleList = await productService.getEligibleProducts(userId);
  const elig = eligibleList.find(p => p.id === product_id);
  if (!elig || !elig.eligible) return res.status(403).json({ success: false, message: 'User not eligible for selected product' });

  // Create quote session in database
  const id = `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const base = product.base_premium;
  const price_range = [Math.max(50, Math.round(base * 0.7)), Math.round(base * 1.2)];
  
  const db = container.services.supabase || container.services.db;
  if (db && db.from) {
    const { error } = await db.from('user_quotes').insert({
      id,
      user_id: userId,
      product_id,
      quote_data: { inputs: inputs || {}, price_range },
      status: 'in_progress',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (error) throw error;
  }
  
  res.json({ success: true, data: { quote_session_id: id, product_id, price_range, next_step: 'provide_details' } });
}));
```

Update `/:id/status` endpoint:

```javascript
router.get('/:id/status', authenticateUser, asyncHandler(async (req, res) => {
  const db = container.services.supabase || container.services.db;
  let quote = null;
  
  if (db && db.from) {
    const { data, error } = await db.from('user_quotes').select('*').eq('id', req.params.id).single();
    if (!error && data) {
      quote = {
        id: data.id,
        status: data.status,
        price_range: data.quote_data?.price_range || [],
        expires_at: data.expires_at
      };
    }
  }
  
  if (!quote) return res.status(404).json({ success: false, message: 'Not found' });
  
  const expired = new Date(quote.expires_at) < new Date();
  if (expired && quote.status !== 'expired') {
    if (db && db.from) {
      await db.from('user_quotes').update({ status: 'expired' }).eq('id', req.params.id);
    }
    quote.status = 'expired';
  }
  
  res.json({ success: true, data: { status: quote.status, price_range: quote.price_range, next_step: quote.status === 'in_progress' ? 'review' : 'complete' } });
}));
```

Update `/:id/complete` endpoint:

```javascript
router.post('/:id/complete', authenticateUser, asyncHandler(async (req, res) => {
  const db = container.services.supabase || container.services.db;
  let quote = null;
  
  if (db && db.from) {
    const { data, error } = await db.from('user_quotes').select('*').eq('id', req.params.id).single();
    if (!error && data) quote = data;
  }
  
  if (!quote) return res.status(404).json({ success: false, message: 'Not found' });
  
  const expired = new Date(quote.expires_at) < new Date();
  if (expired) return res.status(410).json({ success: false, message: 'Quote session expired' });
  
  const price_range = quote.quote_data?.price_range || [100, 200];
  const final_price = Math.round((price_range[0] + price_range[1]) / 2);
  
  if (db && db.from) {
    await db.from('user_quotes').update({ 
      status: 'complete',
      final_price,
      completed_at: new Date().toISOString()
    }).eq('id', req.params.id);
  }
  
  res.json({ success: true, data: { status: 'complete', final_price } });
}));
```

**File: `backend/schema.sql`** - Verify table exists (line ~100-115):

```sql
CREATE TABLE user_quotes (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL,
    quote_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'in_progress',
    final_price INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Testing

1. Create test script `backend/test/quotes.test.js`
2. Test quote creation with valid product
3. Test quote status retrieval
4. Test quote expiry logic (24 hours)
5. Test quote completion flow
6. Verify database records are created
7. Test error cases (invalid product, expired quote)

---

## Gap 3: Achievement Auto-Checking (Backend)

### Problem

Achievements don't automatically unlock when conditions are met (e.g., on mission complete).

### Solution

Implement achievement checking service and integrate with mission completion.

**File: `backend/services/achievement.service.js`** (NEW)

Create new achievement service:

```javascript
import { logger } from '../utils/logger.js';

export class AchievementService {
  constructor(database, gamificationService) {
    this.db = database;
    this.gamification = gamificationService;
  }

  async checkAndUnlockAchievements(userId, triggerType, currentStats) {
    if (!this.db || !this.db.from) return [];
    
    try {
      // Get all active achievements
      const { data: allAchievements, error: achError } = await this.db
        .from('achievements')
        .select('*')
        .eq('is_active', true);
      
      if (achError) throw achError;
      
      // Get user's already earned achievements
      const { data: userAchievements, error: userError } = await this.db
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);
      
      if (userError) throw userError;
      
      const earnedIds = new Set(userAchievements.map(ua => ua.achievement_id));
      const newlyUnlocked = [];
      
      // Check each achievement condition
      for (const achievement of allAchievements) {
        if (earnedIds.has(achievement.id)) continue;
        
        const unlocked = this.checkCondition(achievement, currentStats);
        if (unlocked) {
          // Award achievement
          const { error: insertError } = await this.db
            .from('user_achievements')
            .insert({
              user_id: userId,
              achievement_id: achievement.id,
              notification_sent: false
            });
          
          if (!insertError) {
            // Award XP, coins, lifescore boost
            if (achievement.xp_reward > 0) {
              await this.gamification.awardXP(userId, achievement.xp_reward);
            }
            if (achievement.coin_reward > 0) {
              await this.gamification.awardCoins(userId, achievement.coin_reward);
            }
            if (achievement.lifescore_boost > 0) {
              await this.gamification.adjustLifeScore(userId, achievement.lifescore_boost);
            }
            
            newlyUnlocked.push(achievement);
            logger.info('Achievement unlocked', { userId, achievementId: achievement.id });
          }
        }
      }
      
      return newlyUnlocked;
    } catch (error) {
      logger.error('Achievement check error', error);
      return [];
    }
  }

  checkCondition(achievement, stats) {
    const { condition_type, condition_value } = achievement;
    
    switch (condition_type) {
      case 'missions_completed':
        return (stats.total_missions_completed || 0) >= condition_value;
      case 'streak_count':
        return (stats.current_streak || 0) >= condition_value;
      case 'lifescore_milestone':
        return (stats.lifescore || 0) >= condition_value;
      case 'xp_milestone':
        return (stats.xp || 0) >= condition_value;
      case 'coins_earned':
        return (stats.coins || 0) >= condition_value;
      case 'days_active':
        return (stats.days_active || 0) >= condition_value;
      case 'scenarios_completed':
        return (stats.scenarios_completed || 0) >= condition_value;
      case 'rewards_redeemed':
        return (stats.rewards_redeemed || 0) >= condition_value;
      default:
        return false;
    }
  }

  async getUserStats(userId) {
    if (!this.db || !this.db.from) return {};
    
    try {
      const { data: user } = await this.db.from('users').select('*').eq('id', userId).single();
      const { data: missions } = await this.db.from('user_missions').select('*').eq('user_id', userId).eq('status', 'completed');
      const { data: scenarios } = await this.db.from('user_scenarios').select('*').eq('user_id', userId);
      const { data: rewards } = await this.db.from('user_rewards').select('*').eq('user_id', userId).eq('status', 'redeemed');
      
      return {
        lifescore: user?.lifescore || 0,
        xp: user?.xp || 0,
        coins: user?.coins || 0,
        current_streak: user?.streak_days || 0,
        total_missions_completed: missions?.length || 0,
        scenarios_completed: scenarios?.length || 0,
        rewards_redeemed: rewards?.length || 0,
        days_active: this.calculateDaysActive(user)
      };
    } catch (error) {
      return {};
    }
  }

  calculateDaysActive(user) {
    if (!user?.created_at) return 0;
    const created = new Date(user.created_at);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }
}
```

**File: `backend/di/container.js`**

Add achievement service to container:

```javascript
import { AchievementService } from '../services/achievement.service.js';

// In services initialization:
services.achievement = new AchievementService(
  services.supabase || services.db,
  services.gamification
);
```

**File: `backend/routes/missions.js`**

Update mission complete handler (around line 145):

```javascript
router.post('/:missionId/complete', 
  authenticateUser,
  validate(completeMissionSchema),
  asyncHandler(async (req, res) => {
    const { missionId } = req.params;
    const userId = req.user.id;

    // Existing completion logic...
    const result = await missionService.completeMission(missionId, userId, req.body);

    // NEW: Check for achievement unlocks
    const achievementService = container.services.achievement;
    if (achievementService) {
      const stats = await achievementService.getUserStats(userId);
      const unlockedAchievements = await achievementService.checkAndUnlockAchievements(
        userId,
        'mission_complete',
        stats
      );
      
      if (unlockedAchievements.length > 0) {
        result.achievements_unlocked = unlockedAchievements.map(a => ({
          id: a.id,
          name_en: a.name_en,
          xp_reward: a.xp_reward,
          coin_reward: a.coin_reward
        }));
      }
    }

    logger.info('Mission completed', { userId, missionId, xp: result.xp_earned });
    res.json({ success: true, data: result });
  })
);
```

### Testing

1. Create test script `backend/test/achievements.test.js`
2. Seed test achievements in database
3. Test mission completion triggers achievement check
4. Verify conditions are evaluated correctly
5. Test XP/coin/lifescore rewards are awarded
6. Verify achievements don't unlock twice
7. Test multiple achievement unlocks at once

---

## Gap 4: Streak & Level Display (Frontend)

### Problem

Health page doesn't show streak count, level badge, or LifeScore trend indicator.

### Solution

Enhance Health page header and LifeScoreRing component.

**File: `src/components/LifeScoreRing.tsx`**

Add trend prop and visual indicator:

```typescript
type LifeScoreRingProps = {
  score: number;
  size?: number;
  trend?: 'up' | 'down' | 'flat';
  level?: number;
  showLevelRing?: boolean;
};

export default function LifeScoreRing({ 
  score, 
  size = 120, 
  trend, 
  level, 
  showLevelRing = false 
}: LifeScoreRingProps) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'var(--qic-accent)' : trend === 'down' ? 'var(--qic-secondary)' : 'var(--qic-muted)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        {/* Level ring (outer) */}
        {showLevelRing && level && (
          <>
            <circle cx="60" cy="60" r="58" fill="none" stroke="var(--qic-border)" strokeWidth="2" />
            <text x="60" y="20" textAnchor="middle" fontSize="10" fill="var(--qic-muted)">
              Lv {level}
            </text>
          </>
        )}
        
        {/* LifeScore ring */}
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--qic-border)" strokeWidth="8" />
        <circle 
          cx="60" cy="60" r="54" fill="none" 
          stroke="var(--qic-primary)" 
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        
        {/* Score text */}
        <text x="60" y="60" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--qic-text)">
          {score}
        </text>
        <text x="60" y="75" textAnchor="middle" fontSize="10" fill="var(--qic-muted)">
          LifeScore
        </text>
      </svg>
      
      {/* Trend indicator */}
      {trend && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          background: trendColor,
          color: trend === 'down' ? '#fff' : '#111',
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          border: '2px solid var(--qic-surface)'
        }}>
          {trendArrow}
        </div>
      )}
    </div>
  );
}
```

**File: `src/pages/Health.tsx`**

Add streak and level to header (around line 40-50):

```typescript
export default function Health() {
  const [profile, setProfile] = useState<any>(null);
  const [modules, setModules] = useState<Record<string, React.ReactNode>>({});
  // ... existing state

  useEffect(() => {
    // ... existing API calls
    getProfile().then((p) => {
      setProfile(p);
      // ... rest of logic
    });
  }, []);

  const streak = profile?.user?.streak_days || profile?.stats?.streak_days || 0;
  const level = profile?.user?.level || profile?.stats?.level || 1;
  const lifescore = profile?.user?.lifescore || profile?.stats?.lifescore || 0;

  return (
    <div style={{ paddingBottom: 64 }}>
      <div className="qic-pattern-stars" style={{ padding: '16px 0', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          {/* LifeScore Ring with trend */}
          <LifeScoreRing 
            score={lifescore} 
            size={100}
            trend={profile?.lifescore_trend || 'flat'}
            level={level}
            showLevelRing={true}
          />
          
          {/* Stats cards */}
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            {/* Streak card */}
            <div className="qic-card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🔥</span>
              <div>
                <div style={{ fontSize: 14, color: 'var(--qic-muted)' }}>Streak</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{streak} days</div>
              </div>
            </div>
            
            {/* Level card */}
            <div className="qic-card" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <div>
                <div style={{ fontSize: 14, color: 'var(--qic-muted)' }}>Level</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{level}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rest of existing content... */}
      <div className="grid-modules">
        {/* ... existing modules */}
      </div>
      
      <BottomNav />
    </div>
  );
}
```

### Testing

1. Test LifeScoreRing renders with all props
2. Test trend arrow displays correctly (↑/↓/→)
3. Test level ring visibility toggle
4. Test Health page displays streak and level
5. Test responsive layout on mobile
6. Verify accessibility (aria-labels, color contrast)

---

## Comprehensive Testing Strategy

### 1. Backend API Testing

Create `backend/test/integration.test.js`:

- Test all 4 gaps together in sequence
- Test analytics → behavior summary → achievement unlock flow
- Test quote creation → storage → retrieval → expiry
- Test mission complete → achievement check → rewards

### 2. Database Validation

Create SQL verification queries:

```sql
-- Verify analytics events
SELECT COUNT(*), event_type FROM user_behavior_events 
WHERE user_id = 'test-user' GROUP BY event_type;

-- Verify quotes stored
SELECT * FROM user_quotes WHERE user_id = 'test-user';

-- Verify achievements unlocked
SELECT ua.*, a.name_en FROM user_achievements ua
JOIN achievements a ON ua.achievement_id = a.id
WHERE ua.user_id = 'test-user';
```

### 3. Frontend Integration Testing

Manual test checklist:

- [ ] Load Health page, verify streak/level display
- [ ] Complete mission, verify achievement toast
- [ ] Check Achievements page shows new unlock
- [ ] Start quote, verify status endpoint returns data
- [ ] Navigate pages, verify analytics events logged
- [ ] Check trend arrow changes with LifeScore

### 4. Error Handling Validation

Test error scenarios:

- Database connection failures (use mock mode)
- Invalid user IDs
- Expired quote sessions
- Duplicate achievement unlocks
- Race conditions on simultaneous mission completions

### 5. Performance Testing

- Benchmark analytics insert time (< 100ms)
- Test behavior summary with 1000+ events
- Test achievement check with 50+ achievements
- Verify no memory leaks in quote storage

---

## Deployment Checklist

1. **Database Migration**

   - Verify all tables exist in production Supabase
   - Add indexes: `user_behavior_events(user_id, created_at)`
   - Add indexes: `user_quotes(user_id, status)`
   - Add indexes: `user_achievements(user_id)`

2. **Environment Variables**

   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` set
   - Ensure `USE_SUPABASE=true` in production

3. **Service Initialization**

   - Verify AchievementService in DI container
   - Verify all database connections stable
   - Test failover to mock mode if database unavailable

4. **Monitoring**

   - Add logging for achievement unlocks
   - Add logging for quote lifecycle
   - Add logging for analytics event failures
   - Set up alerts for database errors

---

## Success Criteria

- [ ] Analytics events persist to database
- [ ] Behavior summary queries return real data
- [ ] Quote sessions stored and retrieved from database
- [ ] Achievements auto-unlock on mission complete
- [ ] Streak and level display on Health page
- [ ] LifeScore trend indicator shows correct arrow
- [ ] All tests pass with >90% coverage
- [ ] No regressions in existing functionality
- [ ] Performance benchmarks met
- [ ] Error handling gracefully degrades

### To-dos

- [ ] Implement analytics persistence - Update AnalyticsRepo with real Supabase writes for insertBehaviorEvent, getBehaviorSummary, getRecentEvents
- [ ] Create and run analytics tests - Event insertion, behavior summary, trend calculation, error handling
- [ ] Implement quote database storage - Replace Map with Supabase operations in routes/quotes.js for all endpoints
- [ ] Create and run quote tests - Creation, status, expiry, completion, database persistence
- [ ] Create AchievementService - Implement checkAndUnlockAchievements, checkCondition, getUserStats
- [ ] Integrate achievement checking - Add to DI container, hook into mission completion endpoint
- [ ] Create and run achievement tests - Auto-unlock, condition evaluation, reward awarding
- [ ] Enhance LifeScoreRing component - Add trend prop, arrow indicator, level ring support
- [ ] Update Health page header - Display streak with fire emoji, level badge, use enhanced LifeScoreRing
- [ ] Test frontend enhancements - LifeScoreRing variations, Health page display, responsive layout
- [ ] Run comprehensive integration tests - End-to-end flow testing, database validation, error scenarios
- [ ] Prepare for deployment - Database migration, environment setup, monitoring configuration