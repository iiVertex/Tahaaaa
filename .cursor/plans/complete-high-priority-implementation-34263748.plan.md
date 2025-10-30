<!-- 34263748-aacb-4f3a-b902-b3f23a0639d2 78894858-6ed4-4e19-8448-db91e08b31f1 -->
# Request-Storm Elimination and Stability Plan

## Root Causes

- React StrictMode doubles effects in dev, causing duplicate API calls.
- Uncached data fetching across multiple pages (no react-query), plus parallel calls on route change.
- Ecosystem tracking fires on every navigation and action without throttling.
- Global rate limiter too aggressive and keyed by IP, not session.
- Some components fetch on mount without memoization or sharing.

## Strategy (Treat disease, not symptoms)

1) Client data fetching architecture

- Introduce react-query for shared caching, dedup, staleTime, and retries.
- Wrap api calls: health/profile/rewards/products/ai/social in query hooks with sensible `staleTime` (30–120s) and `retry: false` in dev.
- Coalesce dashboard loads into one batched endpoint later (optional, not blocking).

2) StrictMode-safe effects

- Keep StrictMode for dev but make effects idempotent:
- Use react-query (no custom useEffect fetching) so double-invocation doesn’t duplicate network.
- For any remaining useEffect fetch, add a ref guard.

3) Tracking hygiene

- Throttle/debounce `trackFeatureUsage` and batch duplicates (e.g., same feature within 3–5s ignored).
- Make tracking fire-and-forget with no retries and silent drop on 429.

4) Server rate limits (dev-friendly)

- Relax global limiter in dev (e.g., 1000/15min) and key by `x-session-id`.
- Keep `strictRateLimit` only on sensitive POSTs (quotes/referrals), not on GETs.

5) Verification & guardrails

- Add `scripts/smoke.mjs` modes to simulate nav + clicks bursts.
- Add a simple 429 watchdog in logs; fail CI if 429 > threshold in smoke.

## Concrete Changes

- frontend
- Add react-query provider in `src/main.tsx`.
- Convert `getProfile`, `getRewards`, `getProductsCatalog`, `getRecommendations`, `getSocialFeed` usage to query hooks (staleTime, cacheTime, retry disabled in dev).
- Add `debouncedTrackFeatureUsage` in `src/lib/api.ts` and replace direct calls.
- backend
- `backend/middleware/security.js`: dev limiter to 1000, key by session id; remove strictRateLimit from read-only routes.
- tests
- Extend `scripts/smoke.mjs` to run a burst sequence and assert no 429s.

## Success Criteria

- No 429s during normal navigation and feature actions in dev.
- Network tab shows single requests per resource within staleTime.
- Buttons function reliably; pages render without flapping.
- Smoke script “burst” mode passes.

### To-dos

- [ ] Add React Query provider and config in main.tsx
- [ ] Convert key pages to react-query (profile/rewards/products/ai/social)
- [ ] Add debouncedTrackFeatureUsage and replace direct calls
- [ ] Relax limiter in dev; key by x-session-id; limit strictRateLimit scope
- [ ] Guard any remaining useEffect fetches against double-run
- [ ] Add burst mode to smoke.mjs to assert no 429s