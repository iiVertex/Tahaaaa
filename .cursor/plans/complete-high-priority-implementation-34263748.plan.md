<!-- 34263748-aacb-4f3a-b902-b3f23a0639d2 bf5c696b-fead-47ae-8d81-986468726801 -->
# Coins Discount & Pareto-Optimized Missions/Play Features

## Phase 1: Coins Discount Feature (Additive to Bundle Discounts)

### 1.1 Frontend: BundleCalculator Enhancement

- **File**: `src/components/BundleCalculator.tsx`
- Add `useCoins()` hook to get user coins
- Calculate coins discount: `Math.floor(coins / 500) * 1` (1% per 500 coins, capped at reasonable max)
- Add coins discount ON TOP of existing bundle discount (cumulative)
- Update UI to show:
- Bundle Discount: X% (existing QIC terms)
- Coins Discount: Y% (1% per 500 coins)
- Total Discount: X% + Y%
- Combined savings amount and final total
- Update translation keys for `bundle.coinsDiscount` and `bundle.totalDiscount`

### 1.2 Backend: Product Service Enhancement

- **File**: `backend/services/product.service.js`
- Add `calculateCoinsDiscount(userCoins)` method: returns discount percentage
- Update `calculateBundleSavings()` to accept optional `userCoins` parameter
- Combine bundle discount + coins discount (additive)
- Return both `bundle_discount_percentage` and `coins_discount_percentage` separately

### 1.3 API: Update Bundle Savings Endpoint

- **File**: `backend/routes/products.js`
- Modify `/products/bundle-savings` to accept `userCoins` from authenticated user
- Fetch user coins from database if not provided
- Include coins discount in response

## Phase 2: Daily AI Brief + 3 Adaptive Missions (Missions Tab)

### 2.1 Backend: Daily Brief Generation

- **File**: `backend/services/ai.service.js`
- Add `generateDailyBrief(userId, userProfile)` method
- Use optimized OpenAI prompt (provided) to generate:
- 1-sentence personalized hook (bilingual Arabic/English)
- Falcon/date palm motifs
- Ties to vehicle/family safety
- Store daily brief in `user_profiles` table or cache with TTL (24 hours)
- Add endpoint: `GET /missions/daily-brief`

### 2.2 Backend: 3 Adaptive Missions Generation

- **File**: `backend/services/ai.service.js`
- Add `generateAdaptiveMissions(userId, userProfile)` method
- Use optimized OpenAI prompt to generate exactly 3 missions:
- Easy (no policy requirement): ~50 coins + falcon badge
- Medium (1 policy requirement): ~150 coins + date palm animation
- Hard (2+ policies): ~300 coins + family hospitality leaderboard
- Include cultural hooks (GCC hospitality, bilingual, Qatari motifs)
- Add endpoint: `POST /missions/generate-daily` (resets daily at 8 AM logic)
- Store mission instances with `instance_date` for daily reset tracking

### 2.3 Backend: Daily Reset Logic

- **File**: `backend/services/mission.service.js`
- Add `resetDailyMissions(userId)` method
- Check if last reset was today (compare dates)
- Clear old daily missions and generate new ones via AI
- Integrate with existing `mission_instances` table for tracking

### 2.4 Frontend: Missions Tab UI Update

- **File**: `src/pages/Missions.tsx`
- Add "Daily Brief" banner at top (fetched from `/missions/daily-brief`)
- Display 3 tiered missions (Easy/Medium/Hard) with visual distinctions
- Add "Refresh Daily Missions" button (calls `/missions/generate-daily`)
- Show badge/icon animations (falcon for easy, date palm for medium, family icon for hard)
- Add bilingual text support (Arabic/English toggle)
- Update `MissionCard` to show tiered difficulty styling

## Phase 3: Road-Trip Roulette (Play Tab)

### 3.1 Backend: Roulette Wheel Generation

- **File**: `backend/services/ai.service.js`
- Add `generateRoadTripRoulette(userId, userProfile)` method
- Use optimized OpenAI prompt to generate:
- Wheel spin result (e.g., "Doha Desert Dash")
- 48-hour itinerary (3-5 steps with local spots like Souq Waqif)
- CTAs for roadside assistance/travel cover
- QIC Coins reward + cultural proverb (bilingual)
- Include Qatari cultural references (falcon wheel, GCC adventure spots)
- Add endpoint: `POST /play/roulette-spin` (max 3 spins/day tracked in database)

### 3.2 Backend: Spin Limit Tracking

- **File**: `backend/services/play.service.js` (new file)
- Create service to track daily spin limits per user
- Store in `user_behavior_events` or new `play_activity` table
- Enforce 3 spins/day maximum
- Return remaining spins in response

### 3.3 Frontend: Play Tab UI Enhancement

- **File**: `src/pages/Play.tsx`
- Replace/reorganize to feature Road-Trip Roulette prominently
- Add `RouletteWheel` component with:
- Animated falcon wheel (CSS/spinning animation)
- Spin button (disabled after 3 spins/day)
- Display itinerary steps with local Qatari references
- One-tap CTAs for QIC services (roadside, travel cover)
- Reward display with bilingual proverb
- Add Arabic/English toggle for content
- Show remaining spins counter

## Phase 4: OpenAI Prompt Integration

### 4.1 Backend: Prompt Templates

- **File**: `backend/services/ai.service.js`
- Implement exact prompts as provided:
- Missions Tab Prompt (daily auto-send)
- Play Tab Prompt (on-demand)
- Use `gpt-4o-mini` model for cost efficiency
- Parse JSON responses strictly
- Handle errors gracefully with fallback to mock data

### 4.2 Backend: Cron Job for Daily Brief

- **File**: `backend/jobs/daily-brief.cron.js` (new file)
- Schedule job to run at 8 AM daily (or on-demand for testing)
- Fetch all active users
- Generate daily brief for each user
- Store in database/cache for retrieval

## Phase 5: Cultural/QIC Integration

### 5.1 Translations: Bilingual Support

- **Files**: `src/locales/en.json`, `src/locales/ar.json`
- Add Arabic translations for:
- Daily brief greetings ("Marhaba")
- Mission titles/descriptions
- Roulette spin results
- Cultural proverbs
- Ensure all UI text supports bilingual toggle

### 5.2 UI: Cultural Motifs

- **Files**: Component files (Missions.tsx, Play.tsx, MissionCard.tsx)
- Add falcon icon/badge for achievements
- Add date palm growth animation for medium missions
- Add family hospitality icon for hard missions
- Use QIC brand colors consistently

## Phase 6: Testing & Validation

### 6.1 Unit Tests

- Test coins discount calculation (1% per 500 coins)
- Test additive discount logic (bundle + coins)
- Test daily mission reset logic
- Test spin limit enforcement

### 6.2 Integration Tests

- Test complete bundle discount flow (QIC terms + coins)
- Test daily brief generation and retrieval
- Test 3 adaptive missions generation
- Test roulette spin with itinerary generation

### 6.3 E2E Tests

- Test user journey: View bundle → See coins discount → Calculate total
- Test user journey: Open Missions tab → See daily brief → Complete tiered missions
- Test user journey: Play tab → Spin roulette → View itinerary → Use CTAs

## Implementation Notes

- **Coins Discount**: Always additive, never replaces bundle discount. Display both separately for transparency.
- **Daily Missions**: Reset logic checks `instance_date` - only generate new missions if last reset was not today.
- **OpenAI Costs**: Use `gpt-4o-mini` for ~$0.0002/user/day (Missions) and ~$0.0001/spin (Roulette).
- **Cultural Relevance**: All prompts include Qatari/GCC context, bilingual support, family-oriented messaging.
- **Phase-by-Phase**: Complete each phase fully with testing before moving to next phase.

### To-dos

- [ ] Add coins discount calculation to BundleCalculator (1% per 500 coins, additive to bundle discount)
- [ ] Update ProductService to calculate and combine coins discount with bundle discount
- [ ] Update bundle-savings API endpoint to include user coins and return combined discounts
- [ ] Implement generateDailyBrief() method with OpenAI prompt for bilingual personalized hook
- [ ] Create GET /missions/daily-brief endpoint to fetch daily brief for user
- [ ] Implement generateAdaptiveMissions() with OpenAI prompt for 3 tiered missions (easy/medium/hard)
- [ ] Add resetDailyMissions() method with instance_date tracking for daily resets
- [ ] Create POST /missions/generate-daily endpoint with daily reset enforcement
- [ ] Update Missions.tsx to display daily brief banner and 3 tiered missions with cultural motifs
- [ ] Implement generateRoadTripRoulette() with OpenAI prompt for wheel spin, itinerary, CTAs
- [ ] Create play.service.js to track daily spin limits (max 3 spins/day per user)
- [ ] Create POST /play/roulette-spin endpoint with spin limit enforcement
- [ ] Create RouletteWheel component and update Play.tsx with animated falcon wheel, itinerary display, CTAs
- [ ] Add Arabic translations for daily brief, missions, roulette content in en.json and ar.json
- [ ] Add falcon/date palm/family icons and animations to MissionCard and Play components
- [ ] Create daily-brief.cron.js job to auto-generate briefs at 8 AM (optional, can be on-demand for MVP)