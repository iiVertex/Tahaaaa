<!-- e11d25b3-d6e9-438a-9894-959dbeb8d4a9 4e7f4a60-dc74-4e74-8c92-ae730ae8c263 -->
# CORS/CSP and Routing Fix Plan (Blocking MVP)

## What’s broken

- CORS preflight blocked for origin `http://localhost:8082` (see server logs: "Not allowed by CORS").
- Environment logs show undefined CORS/ENV, so defaults are used and don’t include 8082.
- Helmet CSP may restrict `connect-src` for API calls in some contexts.
- UI still links to `/missions` (warning: "No routes matched location '/missions'") after moving to 3 screens.

## Root cause

- `backend/middleware/security.js` only allows 5173, 8080, 8081 by default. Vite dev is running on 8082. Preflight `OPTIONS` fails before adding CORS headers.
- Helmet CSP is strict by default. In dev it’s safe to relax.
- BottomNav retains outdated route.

## Targeted fixes

### 1) Allow dev origins and handle preflight in dev

Edit `backend/middleware/security.js`:

- Detect dev mode and allow all origins (or read comma-separated `CORS_ORIGIN`).
- Ensure CORS runs before anything else; allow `OPTIONS` with credentials and needed headers.

Essential diff (concept):

```diff
 const allowedOrigins = process.env.CORS_ORIGIN 
   ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
-  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'];
+  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'];
+
+const isDev = process.env.NODE_ENV !== 'production';
+
 const corsOptions = {
-  origin: function (origin, callback) {
-    if (!origin) return callback(null, true);
-    if (allowedOrigins.indexOf(origin) !== -1) callback(null, true);
-    else callback(new Error('Not allowed by CORS'));
-  },
+  origin: isDev ? true : function (origin, callback) {
+    if (!origin) return callback(null, true);
+    if (allowedOrigins.includes(origin)) return callback(null, true);
+    callback(new Error('Not allowed by CORS'));
+  },
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
 };
 
 export const securityMiddleware = [
-  helmet(helmetConfig),
+  helmet(helmetConfig),
   cors(corsOptions),
   limiter
 ];
+
+// (in server.js) also add: app.options('*', cors(corsOptions));
```

### 2) Relax Helmet CSP in dev

In `helmetConfig`, disable CSP in dev or include API origin in `connectSrc`:

```diff
-const helmetConfig = { contentSecurityPolicy: { directives: { ...
-  connectSrc: ["'self'", "https://api.supabase.co"],
+const isDev = process.env.NODE_ENV !== 'production';
+const helmetConfig = {
+  contentSecurityPolicy: isDev ? false : {
+    directives: {
+      defaultSrc: ["'self'"],
+      styleSrc: ["'self'", "'unsafe-inline'"],
+      scriptSrc: ["'self'"],
+      imgSrc: ["'self'", "data:", "https:"],
+      connectSrc: ["'self'", "https://api.supabase.co", "http://localhost:3001"],
+      fontSrc: ["'self'"],
+      objectSrc: ["'none'"],
+      mediaSrc: ["'self'"],
+      frameSrc: ["'none'"],
+    }
+  },
   crossOriginEmbedderPolicy: false
 };
```

### 3) Ensure server registers preflight

In `backend/server.js` add after creating `app` and before routes:

```js
import cors from 'cors';
import { corsOptions } from './middleware/security.js'; // export it
app.options('*', cors(corsOptions));
```

### 4) Set dev env overrides

Create/update `.env` at root or `backend/.env`:

```
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:8080,http://localhost:8081,http://localhost:8082
PORT=3001
```

Restart backend.

### 5) Update BottomNav links

- Change any `/missions` link to `/play` in `src/components/BottomNav.tsx` (and anywhere else).

## Validation checklist

- Open app on 8082; network tab shows 200 for:
  - GET /api/health, /api/missions, /api/rewards, /api/profile
  - POST /api/missions/start and /complete pass preflight
- No more CORS or CSP errors in console.
- Bottom nav routes work (no warning for `/missions`).

## Rollback/Safety

- Dev-only logic is gated by `NODE_ENV !== 'production'`.
- Production path still enforces explicit allowlist via `CORS_ORIGIN`.

## Next after green

- Resume remaining TODOs (AI insights on dashboard, redeem UX, mission toasts, etc.)

### To-dos

- [ ] Allow dev origins (including 8082) and handle preflight in security.js
- [ ] Relax Helmet CSP in dev or add localhost:3001 to connectSrc
- [ ] Register app.options('*', cors(corsOptions)) before routes
- [ ] Set NODE_ENV=development and CORS_ORIGIN with localhost ports
- [ ] Update BottomNav to use /play instead of /missions
- [ ] Verify all core endpoints succeed from 8082 without CORS/CSP errors