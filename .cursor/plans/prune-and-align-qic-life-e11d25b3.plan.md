<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 40996ab8-a17e-4ca8-b185-c4711fa04474 -->
# Backend MVP Validation Plan (PowerShell-first)

### Scope & Goals

- Validate, end-to-end, that the backend fulfills the Track 1 MVP engagement loop:

Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity

- Cover every route, security constraint, state transition, and key error path.
- Produce repeatable, script-driven checks and a concise pass/fail report.

### Pre-requisites

- Backend running at `http://localhost:3001` with `backend/.env`:
  - `NODE_ENV=development`, `PORT=3001`, `CORS_ORIGIN=http://localhost:8082,http://localhost:5173,http://localhost:8080`
- Frontend not required for backend validation, but can be used to spot UI regressions.
- PowerShell 5+ (Windows) to run validation scripts.

### Methodology

- Primary: PowerShell requests (Invoke-RestMethod) with a generated `x-session-id`.
- Supplement: curl commands for quick repros; manual negative cases where needed.
- Artifacts: One JSON summary per run.

### Phase 0 — Environment & Security

- Verify server boots and logs environment/origin.
- Validate CORS preflight works (OPTIONS) and dev CSP is relaxed.

PowerShell

```powershell
$base = 'http://localhost:3001'
Invoke-RestMethod -Method GET -Uri "$base/api/health"
Invoke-WebRequest -UseBasicParsing -Method OPTIONS -Uri "$base/api/missions" -Headers @{ 'Origin'='http://localhost:8082'; 'Access-Control-Request-Method'='GET' }
```

Pass if: 200 OK on health; OPTIONS returns 204/200 and includes CORS headers.

### Phase 1 — Session-based Auth

- Generate session id; all subsequent calls include `'x-session-id'`.
```powershell
$sid = [guid]::NewGuid().ToString('N')
$h = @{ 'x-session-id' = $sid; 'Content-Type' = 'application/json' }
```


Pass if: Auth-required endpoints return 200 with this header and 401 without it.

### Phase 2 — Missions Flow (Core Loop)

1) List missions → 200 + array

2) Start mission → 201/200 + message

3) Complete mission → 200 + rewards object

4) Verify XP/LifeScore/coins/streak increments

```powershell
$missions = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/missions"
$mid = $missions.data.missions[0].id
Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/missions/start" -Body (@{ missionId=$mid }|ConvertTo-Json)
$complete = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/missions/complete" -Body (@{ missionId=$mid }|ConvertTo-Json)
$complete.data.rewards
```

Pass if: rewards contain `xp>0`, `lifescore>0`, `coins>=0`, with consistent user stats.

### Phase 3 — Rewards Hub

1) List rewards → 200 + active rewards

2) Redeem reward (with sufficient coins) → 201/200

3) Verify coin deduction reflected

```powershell
$rewards = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/rewards"
$rid = $rewards.data.rewards[0].id
$redeem = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/rewards/redeem" -Body (@{ rewardId=$rid }|ConvertTo-Json)
```

Pass if: `redeem.success` true and user coins decrease accordingly.

### Phase 4 — AI Recommendations

- Get insights + suggested missions
```powershell
$ai = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/ai/recommendations"
$ai.data.insights; $ai.data.suggested_missions
```


Pass if: Non-empty arrays; structure stable (title/detail/confidence; id/title/category/xp_reward/...)

### Phase 5 — Scenario Simulation

1) Simulate with inputs → returns impact/xp/risk/narrative/suggested_missions

2) Optionally apply → `?apply=true` starts first suggested mission

```powershell
$payload = @{ walk_minutes=30; diet_quality='good' }|ConvertTo-Json
$sim = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/scenarios/simulate" -Body $payload
$apply = Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/scenarios/simulate?apply=true" -Body $payload
```

Pass if: `lifescore_impact>0`, `xp_reward>0`; `apply.data.applied.started` includes 1 mission id.

### Phase 6 — Profile

1) GET profile → user, stats, suggestions present

2) PUT profile → update fields and reflect

```powershell
$profile = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/profile"
$update = Invoke-RestMethod -Headers $h -Method PUT -Uri "$base/api/profile" -Body (@{ username='hero' }|ConvertTo-Json)
```

Pass if: `update.success` true and subsequent GET reflects change.

### Phase 7 — Social

- GET friends; GET leaderboard
```powershell
$friends = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/social/friends"
$board = Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/social/leaderboard"
```


Pass if: Arrays returned; leaderboards ordered sensibly.

### Phase 8 — Onboarding (DI path)

- POST submit with valid 7-step object (exactly 3 integrations), GET progress
```powershell
$onboard = @{ step1=@{risk_tolerance='medium'}; step2=@{exercise_frequency=3;diet_quality='good';daily_routine='moderate'}; step3=@{dependents=1}; step4=@{investment_risk='moderate'}; step5=@{coverage_types=@('health')}; step6=@{integrations=@('QIC Mobile App','QIC Health Portal','QIC Rewards Program')}; step7=@{} } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Headers $h -Method POST -Uri "$base/api/onboarding/submit" -Body $onboard
Invoke-RestMethod -Headers $h -Method GET -Uri "$base/api/onboarding/progress"
```


Pass if: `success=true`, progress shows 7 steps when subsequently completed.

### Phase 9 — Validation & Error Paths

- Missing/invalid bodies for POSTs → 400 with helpful message (Joi)
- Rate limit exceeded → 429 with message (strict endpoints)
- Unauthorized without headers → 401/400 as appropriate
```powershell
# 400
Invoke-WebRequest -UseBasicParsing -Method POST -Uri "$base/api/missions/start" -Headers $h -Body (@{}|ConvertTo-Json)
# 401
Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$base/api/missions"
```


Pass if: Expected status codes and messages are returned.

### Phase 10 — Performance Smoke

- Ensure P50 latency for core GETs < 150ms locally; POSTs < 300ms.
- Manual check via repeating Invoke-RestMethod (3x) and timing.

### Phase 11 — Logging & Observability

- Confirm logs on each route include: method, path, sessionId, and key business events (started/completed/awarded).
- Inspect console/log output after each phase.

### Phase 12 — Supabase Toggle (Optional)

- With `USE_SUPABASE=true` and valid keys, re-run Phases 2–8 to ensure identical contract.
- Pass if: same responses (minus ids/timestamps) and integrity (FKs) enforced.

### Script Runner (Consolidated)

- Use the existing `scripts/test-api.ps1` as a base; extend to include AI, scenarios apply, onboarding, social, negative tests, and JSON result emission.

Run

```powershell
powershell -File .\scripts\test-api.ps1 | Out-File .\last-backend-validation.json
Get-Content .\last-backend-validation.json
```

### Exit Criteria (All must pass)

- **Security**: CORS preflight passes; dev CSP does not block API; auth works with session id; rate-limited routes enforce 429.
- **Core Loop**: Missions start/complete updates XP, LifeScore, coins, streak; Rewards redeem adjusts coins; Profile reflects stats; AI insights present; Scenarios simulate and can apply suggested missions.
- **Stability**: All endpoints respond 2xx with valid bodies; error paths respond with appropriate 4xx/429 and messages.
- **Observability**: Logs capture key actions and user/session context.
- **(Optional)** Supabase mode parity.

### To-dos

- [ ] Extend scripts/test-api.ps1 to cover AI, scenarios apply, onboarding, negative tests
- [ ] Emit consolidated JSON summary to last-backend-validation.json
- [ ] Add basic latency timing and thresholds to script output
- [ ] Add optional SUPABASE mode test block with USE_SUPABASE=true