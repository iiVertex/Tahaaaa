# QIC Life Intelligence Engine — Implementation Blueprint (Cursor-Ready)

This document instructs Cursor to build the **QIC Life Intelligence Engine** — a lean personalization layer that evolves user engagement intelligently without touching unrelated features.  

The context must be fully clear from the start:  

We're creating a **self-contained, Supabase-backed personalization service** that initially uses **rule-based logic** and then **progressively transitions** to AI API calls (OpenAI/Anthropic) for mission generation, UI prompts, and cross-sell recommendations.  

No overengineering. No abstraction for abstraction's sake. Just build the exact mechanism described here — **direct, modular, auditable**.

---

## PURPOSE

Create an internal microservice named `qic-intel` that:

- Logs and learns from all user activity via Supabase.

- Reacts to specific triggers (`session_end`, `mission_complete`, etc.).

- Returns personalized actions as JSON (`missions`, `ui_prompts`, `cross_sell`, etc.).

- Uses **rule-based logic first**, then **gradually replaces** those with **AI API calls** where relevant.

- Persists all AI interactions and applied results for traceability.

---

## STACK

- **Cursor** → AI development environment for full automation.

- **Supabase** → Auth + Database.

- **AI API (OpenAI/Anthropic)** → For personalization prompt calls.

- **Node / TypeScript** → Edge Function for `/ai/personalize`.

---

## HIGH-LEVEL OVERVIEW

```
frontend (Next.js/Flutter)

↓

/ai/personalize (Edge Function)

↓

Supabase (users, sessions, activity, ai_state)

↓

AI API (OpenAI/Anthropic)
```

---

## STAGE-BY-STAGE IMPLEMENTATION MAP

### **Stage 0 – Prep**

Create or verify required Supabase tables and indexes.

```sql
create table if not exists ai_state (
  id bigserial primary key,
  user_id bigint references users(id),
  last_prompt text,
  last_ai_response jsonb,
  applied_changes jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_state_user on ai_state(user_id);
```

Ensure existing:

* `users` table

* `user_activity` table (columns: event_type, event_data JSONB, session_id, coins_earned, lifescore_change, created_at)

* `user_sessions` table (optional for context linking)

---

### **Stage 1 – Endpoint Setup**

Implement `/ai/personalize` Edge Function.

**Function:**

1. Accepts POST with `{ user_id, trigger, context }`.

2. Fetches relevant Supabase data:

   * User info (age, nationality, preferences, coins, lifescore).

   * Last 30 `user_activity` rows.

   * Last `ai_state`.

3. Runs rule-based personalization (see below).

4. Optionally calls AI API (if conditions met).

5. Stores prompt and response in `ai_state`.

6. Returns deterministic `applied_changes` JSON.

---

### **Stage 2 – Rule-Based Personalization (Initial Phase)**

Implement a rule engine first. These ensure immediate deterministic output even before AI integration.

**Rules:**

1. **Coins banner:** if `coins >= 500 && not used recently` → show reward banner.

2. **Cross-sell:** if explored multiple product categories → suggest bundle.

3. **Re-engagement:** if inactive 7+ days → recommend low-effort mission.

4. **Mission escalation:** if missed 3 missions consecutively → reduce difficulty, raise reward.

5. **LifeScore drop:** if LifeScore fell 5+ in 14 days → suggest educational prompt.

Return structure:

```json
{
  "user_id": 101,
  "applied_changes": {
    "missions": [],
    "ui_prompts": ["show_rewards_banner"],
    "cross_sell": ["bundle_suggest"],
    "lifescore_weights": {},
    "coins_delta": 0,
    "explain": "low activity; showing simple re-engagement prompt"
  },
  "metadata": { "source": "rule", "ai_confidence": 0.0 }
}
```

---

### **Stage 3 – AI API Integration (Progressive Replacement)**

After rules are functional, integrate the AI layer.

Conditions to trigger AI call:

* High-activity users (≥X events/day).

* Manual admin trigger.

* Weekly scheduled refresh.

* Mission fatigue or LifeScore stagnation.

The AI call replaces the rule output with richer recommendations.

**AI Prompt (Server-Built JSON):**

```json
{
  "system": "You are QIC Life's Adaptive Personalization Engine. Output JSON matching RESPONSE_SCHEMA only.",
  "input": {
    "user_summary": {
      "id": 101,
      "age": 28,
      "nationality": "Qatari",
      "preferences": ["family","travel"],
      "coins": 300,
      "lifescore": 65,
      "level": 5
    },
    "recent_activity": [
      {"event_type":"mission_complete","category":"home_safety"},
      {"event_type":"plan_explore","product":"travel"}
    ],
    "goals": { "primary": "increase_daily_visits", "secondary":["cross_sell_multi_product"] },
    "available_actions": ["generate_missions","show_banner","suggest_bundle","adjust_lifescore_weights","award_coins"],
    "constraints": ["no PII","max 5 missions","prefer low-friction actions"]
  }
}
```

**Expected AI Response Schema:**

```json
{
  "source": "ai",
  "ai_confidence": 0.85,
  "missions": [
    {
      "id": "mission_001",
      "title": "Travel Ready",
      "difficulty": "medium",
      "steps": ["update travel insurance","add emergency contact"],
      "reward_coins": 15,
      "lifescore_impact": 3
    }
  ],
  "ui_prompts": [
    { "id": "banner_travel", "type": "banner", "priority": 1, "text": "Explore Travel Cover", "cta": "open_travel_plan" }
  ],
  "cross_sell": [{ "product_id": "health_travel_combo", "reason": "family travel interest" }],
  "lifescore_weights": { "travel": 0.03 },
  "coins_delta": 0,
  "explain": "User shows travel interest; boosting travel missions"
}
```

Validate schema before use.

Store `last_prompt`, `last_ai_response`, `applied_changes` in `ai_state`.

---

### **Stage 4 – Automation and Orchestration**

1. **Trigger automation:**

   * Hook `/ai/personalize` on `mission_complete`, `session_end`, and manual admin calls.

2. **Background queue:** optional lightweight worker for debounced AI calls.

3. **Real-time updates:** front-end subscribes to Supabase Realtime for new `ai_state` entries.

4. **Analytics:** track success of applied changes (did user act within 7 days?).

---

### **Stage 5 – Transition Plan**

The system starts **rule-first**, then transitions to **AI-preferred** logic gradually:

1. Stage 1–2: Rules only.

2. Stage 3: AI optional (flag-controlled).

3. Stage 4: AI default; rules only as fallback.

4. Stage 5: Optimize prompt weights and frequency using stored `ai_state` performance metrics.

---

## ENDPOINT CONTRACT

**POST /ai/personalize**

**Request:**

```json
{ "user_id": 123, "trigger": "mission_complete", "context": {} }
```

**Response:**

```json
{
  "user_id": 123,
  "applied_changes": { ... },
  "metadata": { "source": "ai" | "rule", "ai_confidence": 0.0-1.0 }
}
```

**Storage:**

* Save both prompt + AI response + applied changes in Supabase.

* Encrypt if policy requires.

* Log all changes with timestamps.

---

## SECURITY NOTES

* Never send raw PII to AI.

* Use pseudonymous IDs and anonymized context.

* Rate-limit AI calls per user (once every 30 mins).

* Store all prompts and results securely.

---

## MONITORING METRICS

* `ai_calls_per_day`

* `ai_success_rate` (% of recommended actions completed)

* `avg_response_time`

* `cost_per_success`

---

## FINAL CURSOR DIRECTIVE

```
Implement the `qic-intel` microservice:

- Supabase schema: add `ai_state`.

- Endpoint `/ai/personalize`: rule-based first, AI-backed second.

- Persist all interactions and results.

- Gradually phase out rule-based logic as AI confidence improves.

- Ensure all actions remain minimal, auditable, and isolated to personalization features only.
```

Cursor should automatically:

1. Create migration files.

2. Generate `/ai/personalize` Edge Function.

3. Implement schema validation + Supabase client code.

4. Add minimal tests.

5. Output complete working microservice.

**Done.**

