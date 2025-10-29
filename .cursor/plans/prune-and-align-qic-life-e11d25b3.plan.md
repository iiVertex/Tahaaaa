<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 58bb9dac-9fad-4204-9fab-d75a80550b64 -->
# Qatar-Themed Frontend Development Plan

## Phase 1: Design System & Theme Setup (Foundation)

### 1.1 Install Dependencies
- Install framer-motion for animations: `npm install framer-motion`
- Verify existing Radix UI, shadcn/ui, Tailwind are functional

### 1.2 Update Qatar Color Palette
**File: `src/index.css`**
- Replace existing colors with Qatar theme:
  - `--qic-primary: #444097` (Qatar purple)
  - `--qic-accent: #FFD700` (gold)
  - `--qic-secondary: #800000` (maroon)
  - `--qic-bg: #FAFAFA` (light cream)
  - Keep existing text/border variables
- Add CSS custom properties for patterns:
  - `--pattern-star: url('data:image/svg+xml,...')` for geometric stars
  - `--pattern-mosaic: url('data:image/svg+xml,...')` for borders

### 1.3 Create Qatar Cultural Assets Component
**New File: `src/components/QatarAssets.tsx`**
- Fetch/embed SVG components from web sources:
  - Dallah (coffee pot) icon component
  - Date palm motif component
  - Geometric Islamic pattern component (interlocking stars)
- Export as reusable React components with customizable size/color props

### 1.4 Create Animation Utilities
**New File: `src/lib/animations.ts`**
- Define framer-motion variants for:
  - LifeScore number countup animation
  - Mission card entrance (fade + slide)
  - Reward unlock celebration (scale + bounce)
  - Insight badge pulse
- Mark advanced animations with `// TODO: Enhance later` comments

## Phase 2: API Integration Layer (Data Flow)

### 2.1 Extend API Client for 3 Core Endpoints
**File: `src/lib/api.ts`**
- Add `getAIInsights()` → `GET /api/ai/recommendations` (returns insights array)
- Keep existing `getRecommendations()` for missions
- Keep existing `simulateScenario()` for scenarios
- Add types/schemas to `src/lib/schemas.ts`:
  - `InsightSchema` (title, detail, confidence, priority, action_hint)
  - `MissionRecommendationSchema` (extends MissionSchema with ai_rationale, product_spotlight)
  - `ScenarioPredictionSchema` (already exists, verify structure)

### 2.2 Create Personalization Hook (Future-Ready)
**New File: `src/hooks/usePersonalization.ts`**
- Custom hook to fetch layout configuration (stub for now):
  - Returns default module order: `['health-summary', 'ai-insights', 'suggested-missions', 'general-missions', 'rewards-offers']`
  - Add `// TODO: Connect to GET /api/personalization/layout` comment
- Use this in Dashboard to dynamically order components

## Phase 3: Core Screen Development (3 Screens)

### 3.1 Refactor Dashboard (Health.tsx → Dashboard)
**File: `src/pages/Health.tsx`** (rename logic, keep file)
- **Header Section**:
  - Display "مرحبا" (Marhaba - Welcome) with dallah icon
  - Show user's LifeScore as circular progress (0-100) using `@radix-ui/react-progress`
  - Add trend arrow (↑↓) based on recent change (mock for now)
  - Animate number countup with framer-motion
- **Dynamic Modules** (ordered by `usePersonalization`):
  1. **Health Summary Card**: LifeScore, XP, Level, Streak (existing logic)
  2. **AI Insights Card** (NEW): Fetch `getAIInsights()`, display 1-3 insights with confidence badges, action hints as subtle buttons
  3. **Suggested Missions Card** (NEW): Fetch `getRecommendations()`, show top 3 AI-recommended missions with `ai_rationale` tooltips, product spotlight badges
  4. **Quick Actions**: Links to Play page and Rewards
- **Background**: Subtle geometric pattern overlay (low opacity)
- **Spacing**: Use majlis-inspired card groupings (cozy gaps, rounded corners)

### 3.2 Enhance Play Page (Existing Play.tsx)
**File: `src/pages/Play.tsx`**
- **Missions Section**:
  - Fetch `getMissions()` + `getRecommendations()` and merge
  - Display as cards with category badges (health/safe_driving/policy_review)
  - Show difficulty (easy/medium/hard) with star icons
  - Add "AI Pick" badge for recommended missions
  - Animate card entrance on load
  - Start/Complete buttons trigger backend, show success toast with XP/coins earned
- **Scenario Simulator Section**:
  - Keep existing input form (walk_minutes, diet_quality, etc.)
  - Style inputs with Qatar colors
  - Call `simulateScenario()`, display prediction narrative with LifeScore impact visualization (before/after bars)
  - Show suggested missions from scenario result, allow one-click start
- **Cultural Icons**: Use date palm icon for health missions, dallah for wellness

### 3.3 Enhance Rewards Page (Existing Rewards.tsx)
**File: `src/pages/Rewards.tsx`**
- **Header**: Show coin balance with gold accent, animated coin icon
- **Rewards Grid**:
  - Fetch `getRewards()` from backend
  - Display as cards with partner logos (use placeholders if none)
  - Show coins_cost, discount, valid_until
  - Redeem button with confirmation dialog
  - Animate unlock with framer-motion scale/bounce
- **Cross-Sell Section** (Placeholder):
  - Display "Recommended for You" banner
  - Show 1-2 QIC product recommendations (based on profile - stub for now)
  - Add `// TODO: Connect to AI profile/layout endpoint` comment
- **Cultural Touch**: Geometric border dividers between sections

## Phase 4: Shared Components & UX Polish

### 4.1 Create Qatar-Styled Components
**New File: `src/components/LifeScoreRing.tsx`** (enhance existing)
- Circular progress with gradient (purple → gold)
- Animated number countup using framer-motion
- Trend indicator (↑ green, ↓ red, → gray)

**New File: `src/components/MissionCard.tsx`** (enhance existing)
- Add `ai_rationale` tooltip (Radix Popover)
- Product spotlight badge (gold accent)
- Category icon (health → palm, safety → shield, etc.)
- Difficulty stars (1-3 stars for easy/medium/hard)
- Entrance animation on mount

**New File: `src/components/InsightCard.tsx`** (NEW)
- Display insight title, detail, confidence meter (0-1 as percentage)
- Priority badge (high/medium/low with colors)
- Action hint as subtle CTA button
- Pulse animation for high-priority insights

**New File: `src/components/QatarPattern.tsx`** (NEW)
- Renders geometric SVG pattern as background/divider
- Props: variant ('stars' | 'mosaic'), opacity, color

### 4.2 Update Bottom Navigation
**File: `src/components/BottomNav.tsx`**
- Restyle with Qatar colors (active = gold, inactive = gray)
- Add subtle icon background on active state
- Keep existing 3-screen structure (Dashboard, Play, Rewards)

### 4.3 Create Toast Notification System
**New File: `src/components/Toast.tsx`**
- Use Radix Toast primitive
- Qatar-styled success/error variants
- Trigger on mission complete, reward redeem, etc.
- Animate with framer-motion slide-in

### 4.4 Loading States & Skeletons
**File: `src/components/Skeletons.tsx`** (enhance existing)
- Add shimmer effect with Qatar gradient
- Create InsightSkeleton, MissionSkeleton, RewardSkeleton variants

## Phase 5: Animation & Micro-Interactions

### 5.1 LifeScore Animations
- Number countup when value changes (framer-motion animate prop)
- Pulse glow effect on increase (CSS keyframe + framer-motion)
- Confetti burst for milestones (mark as `// TODO: Full implementation`)

### 5.2 Mission Completion Flow
- Button → Loading spinner → Success checkmark animation
- Card fade-out on complete
- Toast notification with earned rewards

### 5.3 Reward Redemption Flow
- Modal confirmation with coin deduction preview
- Success animation (coin icon flies to balance)
- Mark completed rewards with "Redeemed" badge

## Phase 6: Responsive & Mobile-First

### 6.1 Mobile Layout Adjustments
- Ensure all cards stack vertically on <768px
- Bottom nav sticky on mobile
- Touch-friendly button sizes (min 44px)
- Test on 375px width (iPhone SE baseline)

### 6.2 Tablet/Desktop Enhancements
- Dashboard modules in 2-column grid on >768px
- Play page split: missions left, simulator right
- Rewards in 3-column grid on >1024px

## Phase 7: Error Handling & Polish

### 7.1 API Error Fallbacks
- If `getAIInsights()` fails: show generic motivational message
- If `getRecommendations()` fails: fall back to regular missions list
- If `simulateScenario()` fails: display error with retry button

### 7.2 Empty States
- No missions: "Check back soon" with palm icon
- No insights: "Keep completing missions to unlock insights"
- No rewards: "Earn more coins to unlock rewards"

### 7.3 Accessibility
- ARIA labels for all interactive elements
- Focus visible states (Qatar purple outline)
- Keyboard navigation for modals/toasts

## Phase 8: Final Integration & Testing

### 8.1 Connect All 3 Core Endpoints
- Verify `getRecommendations()` returns missions + insights
- Test `simulateScenario()` with various inputs
- Confirm backend returns expected schemas

### 8.2 End-to-End User Flows
1. Dashboard load → see LifeScore, insights, suggested missions
2. Click mission → start → complete → see XP/coin toast → LifeScore updates
3. Simulate scenario → see prediction → start suggested mission
4. Go to Rewards → redeem with coins → see updated balance

### 8.3 Performance Check
- API calls <2s (already backend requirement)
- Page load animations smooth (60fps)
- No layout shift on data load (use skeletons)

## Phase 9: Documentation & Handoff

### 9.1 Add Component Storybook Comments
- JSDoc comments for Qatar-themed components
- Props documentation with examples

### 9.2 Update README Frontend Section
- Add Qatar design system details
- Document cultural icon usage
- List installed dependencies (framer-motion)

### 9.3 Create TODO.md for Future Enhancements
- Full Arabic translation + RTL
- Advanced animations (confetti, particle effects)
- Profile/layout endpoint integration
- Supabase real-time updates
- Social features (leaderboard page)

---

## Implementation Notes

**Backend Untouched**: All changes are frontend-only (src/ directory). No modifications to backend/ files.

**Phased Approach**: Start with Phase 1-3 for functional MVP, then iterate on UX polish in Phase 4-6.

**Cultural Authenticity**: Use web-sourced SVG assets for dallah, palm, geometric patterns. Embed inline or as React components.

**Animation Balance**: Framer-motion for key moments (LifeScore, mission complete), CSS transitions for subtle interactions. Mark advanced animations as TODOs.

**API Schema Validation**: Use existing Zod schemas in `src/lib/schemas.ts`, extend for new AI endpoints.

**Mobile-First**: Build for 375px viewport first, enhance for larger screens.


### To-dos

- [ ] Install framer-motion for animations
- [ ] Update color palette in index.css to Qatar theme (purple #444097, gold #FFD700, maroon #800000)
- [ ] Create QatarAssets.tsx with dallah, palm, geometric pattern SVG components from web
- [ ] Create animations.ts with framer-motion variants for LifeScore, missions, rewards
- [ ] Add getAIInsights() to api.ts and create InsightSchema in schemas.ts
- [ ] Create usePersonalization.ts hook with default module order (stub for layout endpoint)
- [ ] Refactor Health.tsx into Qatar-themed Dashboard with AI insights, suggested missions, LifeScore ring
- [ ] Enhance Play.tsx with AI-recommended missions, scenario simulator with predictions, cultural icons
- [ ] Enhance Rewards.tsx with coin balance, redemption flow, cross-sell placeholder
- [ ] Create enhanced LifeScoreRing.tsx with circular progress, countup animation, trend indicator
- [ ] Create enhanced MissionCard.tsx with AI rationale tooltip, product spotlight, category icons, difficulty stars
- [ ] Create InsightCard.tsx with confidence meter, priority badge, action hint CTA
- [ ] Create QatarPattern.tsx for background geometric SVG patterns
- [ ] Restyle BottomNav.tsx with Qatar colors (gold active state)
- [ ] Create Toast.tsx using Radix Toast with Qatar-styled variants
- [ ] Enhance Skeletons.tsx with Qatar gradient shimmer effect
- [ ] Test complete user flows: Dashboard load → mission start/complete → scenario sim → reward redeem
- [ ] Create TODO.md with future enhancements (Arabic/RTL, advanced animations, profile/layout endpoints)