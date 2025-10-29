<!-- bc017e77-cd51-45a3-907b-7c0e7f5f75fc 96490673-039e-49d0-bbfb-da008641a52f -->
# Stabilize & Streamline Integration

## Problem Summary

1. **Backend crash loop**: nodemon restarts infinitely due to `node --watch` detecting log writes.
2. **React key warning**: Missing keys in Dashboard module list.
3. **Startup complexity**: Multiple terminals and commands needed.
4. **Frontend connection failures**: Backend unavailable when crashed → ERR_CONNECTION_REFUSED.

## Solution Strategy

### 1. Fix Backend Restart Loop (Priority 1)

**Root cause**: `backend/package.json` uses `nodemon --ignore logs/` but also passes `--watch server.js --watch routes --watch services --watch middleware`, creating conflicting watch patterns that trigger on parent directory changes or log file writes.

**Fix**:

- Update `backend/package.json` dev script to use a stable nodemon config without duplicate watch flags:
  ```json
  "dev": "nodemon server.js"
  ```

- Create `backend/nodemon.json` config file:
  ```json
  {
    "watch": ["server.js", "routes", "services", "middleware", "di"],
    "ignore": ["logs/**", "*.log", "node_modules/**"],
    "ext": "js",
    "delay": "1500"
  }
  ```


**Why this works**: Explicit config prevents conflicting CLI args; `delay: 1500` prevents rapid restart cascades; ignoring `logs/**` and `*.log` prevents file-write triggers.

### 2. Fix React Key Warning (Priority 2)

**Root cause**: In `src/pages/Health.tsx`, the modules map doesn't provide stable keys when iterating.

**Fix**: Wrap each module in a keyed Fragment:

```tsx
<div className="grid-modules">
  {modules['offers-strip'] && <React.Fragment key="offers-strip">{modules['offers-strip']}</React.Fragment>}
  {order.map((k) => modules[k] ? <React.Fragment key={k}>{modules[k]}</React.Fragment> : null)}
</div>
```

### 3. Streamline Startup (Priority 3)

**Goal**: Single `npm run dev:all` command that reliably starts both frontend and backend.

**Current state**: Works but backend crashes intermittently; user sees connection refused.

**Fix** (after applying fixes 1–2):

- Root `package.json` already has:
  ```json
  "dev:all": "concurrently \"npm run dev\" \"npm run backend:dev\""
  ```

- Once backend is stable (nodemon.json fix), this becomes the **single entry point**.

**Alternative** (if concurrently still swallows errors):

- Create a simple PowerShell launcher script `start-dev.ps1`:
  ```powershell
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"
  Start-Sleep -Seconds 2
  npm run dev
  ```

- Add to root `package.json`:
  ```json
  "dev:simple": "powershell -ExecutionPolicy Bypass -File ./start-dev.ps1"
  ```


### 4. Verify Frontend/Backend Sync (Priority 4)

**Current integration points**:

- Frontend `src/lib/requests.ts` uses `baseURL: 'http://localhost:3001'`
- Backend listens on `PORT=3001` (default)
- CORS allows `http://localhost:5173` (Vite default) but frontend runs on `8080+`

**Fix CORS mismatch**:

- Update `backend/.env` to add dynamic CORS:
  ```
  CORS_ORIGIN=http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084
  ```

- Or in `backend/middleware/security.js`, change `corsOptions` to:
  ```js
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  };
  ```


### 5. Remove Disruptive Components (Cleanup)

**Identified**:

- `simple-server.js` (temporary mock, no longer needed)
- Multiple orphaned terminal processes on ports 8080–8083

**Actions**:

- Delete `simple-server.js` if present.
- Kill orphaned processes:
  ```powershell
  Get-Process node | Where-Object {$_.Path -like "*node.exe"} | Stop-Process -Force
  ```

- Restart clean.

## Implementation Order

1. **Create `backend/nodemon.json`**
2. **Update `backend/package.json` dev script**
3. **Fix `src/pages/Health.tsx` key warning**
4. **Update CORS in `backend/middleware/security.js`** (or `.env`)
5. **Delete `simple-server.js`** (if exists)
6. **Kill all node processes** and restart

## Testing Checklist

After fixes:

1. Run `npm run dev:all` from project root
2. Wait 3 seconds for backend to stabilize (check terminal: "QIC Backend Server running")
3. Frontend opens on `http://localhost:8080` (or next available)
4. Open browser DevTools → Network tab
5. Navigate pages:

   - **Dashboard**: Offers strip visible; no ERR_CONNECTION_REFUSED; analytics events logged
   - **Play**: Missions load
   - **Rewards**: Cross-sell and referral button render

6. Click "Get Quote" → Drawer opens, submits successfully → backend logs `POST /api/quotes/start`
7. No React warnings in console
8. Backend terminal shows stable logs (no restart loop)

## Files to Modify

- `backend/nodemon.json` (new)
- `backend/package.json` (line 9: dev script)
- `backend/middleware/security.js` (corsOptions)
- `src/pages/Health.tsx` (module render block ~line 140)
- `simple-server.js` (delete if exists)

## Expected Outcome

- **Single command**: `npm run dev:all` starts both services reliably
- **No crashes**: Backend stays up; logs stabilize
- **No warnings**: React console clean
- **Full integration**: Frontend→Backend API calls succeed; analytics tracked; offers/quotes/referrals functional
- **Developer experience**: Clean startup, clear logs, predictable behavior

### To-dos

- [ ] Add /offers/prequalified and extend /ai/recommendations with product_recommendations
- [ ] Create /products/catalog and bundle helper
- [ ] Implement /quotes/start and /quotes/:id/status with in-memory sessions
- [ ] Add /analytics/events and log/store events
- [ ] Add /referrals/share to generate/track referral codes
- [ ] Extend src/lib/api.ts for offers, products, quotes, referrals, analytics
- [ ] Add Offers strip and Bundle card on Dashboard
- [ ] Add Product Spotlight missions with CTA to quote
- [ ] Add insurance premium delta simulator with apply-to-quote
- [ ] Add cross-sell banner and referral CTA on Rewards
- [ ] Add track() helper and wire events across modules
- [ ] Implement /personalization/layout feature flags and module order