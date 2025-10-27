<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 385d53cf-0f1e-4c3a-9e06-2cf5d1768932 -->
# Frontend (React 18 + TS + Vite) – Eisenhower Implementation

### Eisenhower Priorities (Do First → Do Next → Schedule → Optional)
- Do First (Important/Urgent):
  - UI foundations (Tailwind, shadcn/ui, Radix). Mobile layout + bottom nav.
  - LifeScore Dashboard (visible growth, streaks, coins, tips).
  - Missions (list/detail, start/complete, progress, toasts).
  - Scenario Simulation (form, prediction, suggested missions integration).
- Do Next (Important/Not Urgent):
  - Rewards Hub (Temu-like cards, cart-less redeem flow, coin checks).
  - API client with schemas + type guards (zod) and runtime validation.
  - Error boundary + global toasts; loading skeletons.
- Schedule (Not Urgent/Important):
  - Bilingual i18n (EN/AR), RTL support, content JSONs.
  - Accessibility sweep (focus states, roles, keyboard nav), dark mode.
- Optional (Not Important/Not Urgent for demo):
  - Leaderboard (mini widget + full list screen).
  - Pull-to-refresh, micro-animations (shadcn/ui + Tailwind transitions).

### Architecture & Foundations
- Keep existing Vite app; add Tailwind (postcss, config) and shadcn/ui with Radix primitives.
- Theme: QIC palette via Tailwind theme extension; map to CSS vars if present.
- Design tokens: spacing, font sizes, radii unified via Tailwind.
- Component library: shadcn/ui (Button, Card, Tabs, Toast, Dialog, Sheet, NavigationMenu, Progress, Skeleton, Badge).

### Data & Types
- API client (`src/lib/api.ts`): Keep axios instance; add zod schemas and type guards per endpoint (missions, scenarios, rewards, profile, ai).
- Narrowers: `isMission`, `isScenarioPrediction`, `isReward` fallback to safe defaults.
- Error handling: Centralized `request` wrapper with zod validation + typed errors.

### Screens/Flows (Mobile-first)
- LifeScore Dashboard (`/`): lifeScore ring/progress, XP/level, streak, coins; “Next best action”; recent missions; insights.
- Missions (`/missions`): filter tabs, mission cards, start/complete; mission detail bottom-sheet; progress indicators.
- Scenarios (`/showcase`): inputs (walk, diet, commute); simulate; display prediction + suggested missions; start/complete directly.
- Rewards (`/rewards`): category tabs, coin-gated cards, redeem confirm dialog; success toast; balance updates.
- Leaderboard (optional `/social`): mini widget on dashboard + full list.
- Navigation: bottom tab bar (Home, Missions, Rewards, Profile), floating CTA for “Simulate”.

### i18n, RTL, A11y
- i18next + resources: `en.json`, `ar.json`; language toggle in Profile; `dir=rtl` for Arabic; logical props & Tailwind `rtl:` variants.
- A11y: Radix primitives; labels, aria-live toasts, focus-visible, color contrast.

### Quality Gates
- Typecheck (`tsc --noEmit`), ESLint (basic), zod validation on all API responses, error boundary, loading skeletons.

### Files (Essential)
- tailwind.config.{ts,js}, postcss.config.js, src/index.css (Tailwind base).
- shadcn/ui init (config file) and generated components under `src/components/ui/`.
- src/components/: `BottomNav.tsx`, `LifeScoreRing.tsx`, `MissionCard.tsx`, `RewardCard.tsx`, `ScenarioForm.tsx`, `ToastHost.tsx`, `Skeletons.tsx`.
- src/lib/: `schemas.ts` (zod), `i18n.ts`, `rtl.ts`, `requests.ts` (axios wrapper with validation).
- src/locales/: `en.json`, `ar.json`.
- src/pages/: refactor existing to use components; add `Dashboard.tsx` (or reuse Health page) as lifeScore dashboard.

### Integration Steps (High-level)
1) Install Tailwind + shadcn/ui + Radix; configure theme and base styles.
2) Introduce `requests.ts` wrapper with zod schemas for all API responses.
3) Build BottomNav and mobile layouts; refactor routes to nested layout.
4) Implement Dashboard (lifeScore, insights, recent missions).
5) Implement Missions page (cards + detail sheet + actions).
6) Implement Scenarios (form + prediction + suggested missions, start/complete).
7) Implement Rewards (cards + redeem dialog + coin checks).
8) Optional Leaderboard widget + page.
9) i18n + RTL; content keys applied across components; language toggle.
10) A11y pass + skeletons + toasts; polish.

### Notes
- Keep all flows “visible growth”: progress rings/badges, streak flames, coins pop.
- Keep simple emotional language in en/ar JSON.
- Maintain existing API shapes; add client-side guards only.


### To-dos

- [ ] Install Tailwind, shadcn/ui, Radix; configure theme and base styles
- [ ] Add zod schemas and axios request wrapper with runtime validation
- [ ] Create BottomNav and mobile layout; refactor routes to use it
- [ ] Build LifeScore Dashboard with insights and recent missions
- [ ] Implement missions list, detail sheet, start/complete actions
- [ ] Implement scenario form + prediction + suggested missions actions
- [ ] Implement rewards hub with redeem confirmation and coin checks
- [ ] Add leaderboard widget and page (optional)
- [ ] Add i18next with EN/AR, RTL support, language toggle
- [ ] Add toasts, skeletons, focus-visible, contrast checks