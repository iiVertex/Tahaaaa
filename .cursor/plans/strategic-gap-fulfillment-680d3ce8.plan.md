<!-- 680d3ce8-e0f2-42d8-8522-7010f8857986 920182f1-39dd-4142-b13d-70e81941681e -->
# Strategic Gap Fulfillment: Foundation to Polish

## Phase 1: Backend Infrastructure Foundation (LAYER 1)
**Goal**: Establish complete backend API surface before frontend depends on it

### 1.1 Complete Missing Core Endpoints
**File: `backend/routes/offers.js`** (already created, verify)
- Enhance `/prequalified` endpoint with dynamic user-based logic
- Connect to profile service for personalized offers

**File: `backend/routes/products.js`** (already created, verify)
- Verify `/catalog` endpoint returns full product metadata
- Enhance `/bundle-savings` with realistic discount tiers (2+ products: 12%, 3+ products: 18%)
- Add product eligibility checks based on user profile

**File: `backend/routes/analytics.js`**
- Replace in-memory array with persistent storage via AnalyticsRepo
- Add batch event insertion for performance
- Implement event validation schema
- Add endpoint: `GET /events/summary` (aggregated stats)

**File: `backend/routes/quotes.js`**
- Enhance `/start` with validation and product eligibility
- Add `/quotes/:id/complete` endpoint for finalizing quotes
- Add session expiry logic (24 hours)
- Store quote sessions in database (user_quotes table stub)

**File: `backend/routes/referrals.js`**
- Add referral tracking persistence
- Implement `/track/:code` endpoint for click tracking
- Add reward calculation when referral converts

### 1.2 Wire All Routes in Server
**File: `backend/server.js`**
- Verify offers, products routes are mounted (already done)
- Add error handling middleware per route group
- Add request logging for tracking

---

## Phase 2: Data Flow & AI Integration (LAYER 2)
**Goal**: Replace mocked AI with functional logic and enable real tracking

### 2.1 Implement Real AI Service Logic
**File: `backend/services/ai.service.js`**
- Remove all TODO comments in `generateMissionRecommendations()`
- Implement rule-based AI using user profile + behavior events:
  - Low LifeScore (<50) → suggest health/safety missions
  - High driving hours → suggest safe driving missions
  - No policy review in 90 days → suggest policy missions
- Remove TODO from `predictScenarioOutcome()`
- Implement scenario logic:
  - Calculate risk score based on inputs
  - Generate narrative using template strings
  - Suggest relevant missions based on scenario category
- Remove TODO from `generateAIProfile()`
- Map onboarding responses to profile recommendations

### 2.2 Enable Persistent Analytics
**File: `backend/repositories/analytics.repo.js`**
- Enhance `insertBehaviorEvent()` to write to database
- Add `getBehaviorSummary(userId)` for AI analysis
- Add `getRecentEvents(userId, limit)` for personalization

**File: `backend/services/ai.service.js`**
- Update `predictInsights()` to use behavior summary
- Generate insights based on:
  - Mission completion trends
  - Streak status
  - LifeScore changes
  - Recent activity patterns

### 2.3 Connect Personalization to Frontend
**File: `backend/routes/personalization.js`**
- Verify layout endpoint returns insights + suggested missions (already done)
- Add user-specific module ordering based on stats

**File: `src/hooks/usePersonalization.ts`**
- Remove TODO comment about connecting to endpoint (already connected)
- Add error handling for failed layout fetch
- Add cache/local storage for offline module order

---

## Phase 3: Core Feature Completion (LAYER 3)
**Goal**: Complete backend features that frontend will consume

### 3.1 Enhance Offers/Products Integration
**File: `backend/services/product.service.js`** (NEW)
- Create ProductService class
- Implement `getEligibleProducts(userId)` using profile + LifeScore
- Implement `calculateBundleSavings(productIds)` with tiered logic
- Implement `getProductSpotlight(category)` for mission integration

**File: `backend/routes/ai.js`**
- Update product recommendations to use ProductService
- Make recommendations dynamic based on user behavior

### 3.2 Enhanced Quote Flow
**File: `backend/routes/quotes.js`**
- Add validation: check product exists, user is eligible
- Add step tracking (details → review → confirm)
- Add price calculation based on user risk profile
- Store in database instead of in-memory Map

### 3.3 Enhanced Referrals
**File: `backend/routes/referrals.js`**
- Add coin reward when referral installs (50 coins)
- Track conversion funnel: share → click → install → purchase
- Add `GET /referrals/stats` for user's referral performance

---

## Phase 4: Frontend Component Enhancements (LAYER 4)
**Goal**: Upgrade core UI components with missing features

### 4.1 Enhance MissionCard Component
**File: `src/components/MissionCard.tsx`**
- Add AI rationale tooltip using Radix Popover
- Add product spotlight badge (gold accent)
- Add difficulty stars (1-3 based on difficulty field)
- Add category icon using QatarAssets (DatePalm for health, etc.)
- Add entrance animation on mount

### 4.2 Qatar-Style Toast System
**File: `src/components/Toast.tsx`**
- Add Qatar color variants (success: gold, error: maroon)
- Use Islamic geometric pattern as background accent
- Add slide-in animation from bottom
- Ensure accessibility (aria-live regions)

### 4.3 Enhanced Skeletons
**File: `src/components/Skeletons.tsx`**
- Add Qatar gradient shimmer (purple to gold)
- Create InsightSkeleton variant
- Create MissionSkeleton variant with icon placeholder
- Create RewardSkeleton variant

### 4.4 Apply Basic Qatar Theme
**File: `src/index.css`**
- Verify Qatar colors are applied (already done)
- Add utility classes for patterns (.qic-pattern-stars, .qic-pattern-mosaic)
- Add majlis-inspired spacing variables (--spacing-cozy: 12px)

---

## Phase 5: Gamification & Cross-Sell (LAYER 5)
**Goal**: Complete gamification features and insurance cross-sell

### 5.1 Achievement System Frontend
**File: `src/pages/Achievements.tsx`** (NEW)
- Create achievements page showing earned + locked achievements
- Display badge icons using QatarAssets or emojis
- Show progress bars for in-progress achievements
- Add celebration animation when viewing newly earned achievement

**File: `src/lib/api.ts`**
- Add `getAchievements()` → `GET /api/achievements`
- Add `getUserAchievements()` → `GET /api/achievements/user`

**File: `backend/routes/achievements.js`** (NEW)
- Implement `GET /` endpoint (all achievements)
- Implement `GET /user` endpoint (user's earned achievements)
- Auto-check achievement completion on mission complete

### 5.2 Streak & Level Display
**File: `src/pages/Health.tsx`**
- Add streak display in header (fire emoji + days)
- Add level badge with progress to next level
- Add trend indicator for LifeScore (↑/↓/→)

**File: `src/components/LifeScoreRing.tsx`**
- Add trend prop and display arrow
- Add level ring around LifeScore (outer circle)

### 5.3 Bundle Calculator & Cross-Sell
**File: `src/components/BundleCalculator.tsx`** (NEW)
- Create calculator widget showing product checkboxes
- Calculate savings in real-time using `getBundleSavings()`
- Display breakdown: subtotal, savings %, total
- CTA button to start quote flow

**File: `src/pages/Rewards.tsx`**
- Add cross-sell banner at top
- Display 2-3 recommended products from AI
- Add "Bundle & Save" section using BundleCalculator

### 5.4 Product Spotlight in Missions
**File: `backend/services/mission.service.js`**
- Include product_spotlight field when returning missions
- Filter missions by product category if query param provided

**File: `src/components/MissionCard.tsx`**
- Display product spotlight badge if present
- Add "Learn More" button that opens product details

### 5.5 Insurance Premium Delta Simulator
**File: `src/components/PremiumSimulator.tsx`** (NEW)
- Create slider-based simulator (LifeScore 40 → 80)
- Show premium reduction estimate (-15% at LifeScore 80)
- Display before/after bars
- CTA: "Apply to My Quote" (opens quote drawer)

**File: `src/pages/Play.tsx`**
- Add PremiumSimulator below scenario simulator

---

## Phase 6: Qatar Theme & Cultural Integration (LAYER 6)
**Goal**: Apply full Qatar cultural theme and Arabic support

### 6.1 Arabic Translation Integration
**File: `src/lib/i18n.ts`**
- Verify i18next is configured (already done)
- Add language toggle component in header
- Ensure RTL layout switches when Arabic selected

**File: `src/components/LanguageToggle.tsx`** (NEW)
- Create toggle button (EN/عربي)
- Store preference in localStorage
- Apply `dir="rtl"` to document when Arabic

**File: All page components**
- Wrap hardcoded strings in `t('key')` function
- Use existing ar.json translations

### 6.2 Cultural Icons Throughout
**File: `src/components/QatarAssets.tsx`**
- Verify Dallah, DatePalm, IslamicStar exist (already done)

**Files to update:**
- `src/pages/Health.tsx` - Add dallah icon (already done)
- `src/pages/Play.tsx` - Add date palm for health missions (already done)
- `src/pages/Rewards.tsx` - Add Islamic star pattern dividers
- `src/components/MissionCard.tsx` - Use category-specific icons

### 6.3 Geometric Pattern Backgrounds
**File: `src/components/QatarPattern.tsx`**
- Verify pattern component exists (already done)

**Files to update:**
- `src/pages/Health.tsx` - Add pattern to header (already done)
- `src/pages/Rewards.tsx` - Add mosaic pattern to cross-sell section
- `src/components/InsightCard.tsx` - Add subtle star pattern background

### 6.4 Majlis-Inspired Card Layouts
**File: `src/index.css`**
- Add `.qic-card-majlis` class with cozy padding (16px) and warm shadows
- Update grid gaps to 12px (cozy grouping)

**Files to update:**
- All card components to use majlis spacing
- Group related cards with tighter gaps

---

## Phase 7: Polish & Accessibility (LAYER 7)
**Goal**: Final UX polish, mobile optimization, and accessibility

### 7.1 Mobile Responsiveness
**File: `src/index.css`**
- Verify responsive grids exist (already done)
- Add mobile-specific utilities:
  - `.mobile-hide` (display: none on <768px)
  - `.mobile-stack` (flex-direction: column on <768px)

**Files to update:**
- `src/pages/Health.tsx` - Stack modules on mobile
- `src/pages/Play.tsx` - Stack missions and simulator on mobile
- `src/components/BundleCalculator.tsx` - Single column on mobile

### 7.2 Touch-Friendly Interactions
**All button/interactive elements:**
- Verify min-height: 44px (already in index.css)
- Add active states with slight scale transform
- Increase tap target spacing (min 8px between)

### 7.3 Error Boundaries
**File: `src/components/ErrorBoundary.tsx`** (NEW)
- Create React error boundary component
- Display Qatar-themed error message
- Add "Reload" button and error reporting

**File: `src/App.tsx`**
- Wrap Routes with ErrorBoundary

### 7.4 Enhanced Empty States
**Files to update:**
- `src/pages/Missions.tsx` - Add date palm illustration + motivational message
- `src/pages/Rewards.tsx` - Add coin illustration + "Earn more coins" CTA
- `src/pages/Health.tsx` - Add dallah illustration if no insights

### 7.5 Accessibility Enhancements
**All components:**
- Add aria-labels to interactive elements
- Add aria-live regions for dynamic content (toasts, updates)
- Ensure keyboard navigation works (focus-visible styles already in CSS)
- Add skip-to-content link at top
- Test with screen reader

---

## Implementation Order Summary

**Week 1 - Foundation:**
- Phase 1: Backend Infrastructure (Days 1-2)
- Phase 2: AI Integration (Days 3-4)
- Phase 3: Core Features (Day 5)

**Week 2 - Features:**
- Phase 4: Component Enhancements (Days 1-2)
- Phase 5: Gamification & Cross-Sell (Days 3-5)

**Week 3 - Polish:**
- Phase 6: Qatar Theme (Days 1-3)
- Phase 7: Final Polish (Days 4-5)

## Key Files to Create:
- `backend/services/product.service.js`
- `backend/routes/achievements.js`
- `src/pages/Achievements.tsx`
- `src/components/BundleCalculator.tsx`
- `src/components/PremiumSimulator.tsx`
- `src/components/LanguageToggle.tsx`
- `src/components/ErrorBoundary.tsx`

## Key Files to Enhance:
- `backend/services/ai.service.js` (remove all TODOs)
- `backend/routes/analytics.js` (persistent storage)
- `backend/routes/quotes.js` (full flow)
- `backend/routes/referrals.js` (tracking)
- `src/components/MissionCard.tsx` (full features)
- `src/components/Toast.tsx` (Qatar styling)
- `src/components/Skeletons.tsx` (gradient shimmer)
- All pages for Arabic/cultural integration

## Testing Checklist Per Phase:
- Phase 1: API endpoints return expected data
- Phase 2: AI generates non-mocked recommendations
- Phase 3: Quote/referral flows work end-to-end
- Phase 4: Components render with all enhancements
- Phase 5: Achievements unlock, bundle calculator works
- Phase 6: Arabic toggle works, patterns visible
- Phase 7: Mobile responsive, keyboard accessible


### To-dos

- [ ] Complete backend API endpoints (offers, products, analytics, quotes, referrals)
- [ ] Replace mocked AI with real logic, enable persistent analytics
- [ ] ProductService, enhanced quotes/referrals, personalization connection
- [ ] Enhance MissionCard, Toast, Skeletons with Qatar styling
- [ ] Achievement system, streak display, bundle calculator, premium simulator
- [ ] Arabic translation, cultural icons throughout, pattern backgrounds, majlis layouts
- [ ] Mobile responsiveness, error boundaries, accessibility, enhanced empty states