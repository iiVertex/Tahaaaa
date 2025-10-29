<!-- 34263748-aacb-4f3a-b902-b3f23a0639d2 b6cc0a25-8f4b-4255-9903-557d11ea678e -->
# Package Upgrade & Compatibility Strategy

## Phase 1: Research & Compatibility Audit (Read-Only)

### 1.1 OpenAI SDK v6.x Migration Research

- Check OpenAI v6.x changelog for breaking changes
- Verify GPT-5 Nano model support in v6.x API
- Document required code changes in `backend/services/ai.service.js`
- Key changes expected:
  - Import path changes (`openai` package structure)
  - API method signatures (chat.completions.create)
  - Error handling patterns
  - Configuration object structure

### 1.2 Express v5.1.0 Breaking Changes Audit

- Review Express v5 migration guide
- Check middleware compatibility (`cors`, `helmet`, `express-rate-limit`)
- Identify routing pattern changes
- Document impacts on `backend/server.js` and all route files

### 1.3 Dependency Chain Analysis

- Map all package interdependencies
- Check peer dependency requirements
- Identify potential conflicts between:
  - Express v5 + helmet v8 + express-rate-limit v8
  - OpenAI v6 + Node.js 18+ requirements
  - Frontend Radix UI updates + React 18.3

### 1.4 Frontend Package Compatibility Check

- Audit all Radix UI packages for breaking changes
- Check React Router v6.30 compatibility
- Verify Vite v5.4 supports all plugins
- Review i18next v25 and react-i18next v16 changes

## Phase 2: Backend Package Updates

### 2.1 Update backend/package.json

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.77.0",
    "axios": "^1.13.1",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "express-rate-limit": "^8.1.0",
    "helmet": "^8.1.0",
    "joi": "^18.0.1",
    "jsonwebtoken": "^9.0.2",
    "openai": "^6.7.0",
    "winston": "^3.17.0"
  }
}
```

### 2.2 Refactor `backend/services/ai.service.js` for OpenAI v6

- Update import: `import OpenAI from 'openai'` (default export in v6)
- Update client initialization if needed
- Verify `gpt-5-nano` model string remains valid
- Update error handling to match v6 patterns
- Test all three methods:
  - `generateMissionRecommendations`
  - `generateAIProfile`
  - `predictScenarioOutcome`

### 2.3 Refactor Express v5 Patterns in `backend/server.js`

- Update error handler signature (4-param middleware)
- Check async route handlers compatibility
- Verify CORS middleware placement
- Update body-parser usage (built-in in v5)
- Test route mounting patterns

### 2.4 Update Middleware Files

- `backend/middleware/security.js`: Update helmet v8 config
- `backend/middleware/errorHandler.js`: Verify Express v5 patterns
- `backend/middleware/auth.js`: Check JWT and async patterns
- Update rate limiting config for v8 API

### 2.5 Update Environment Variable Loading

- Refactor dotenv v17 usage in `backend/server.js`
- Test that all env vars still load correctly
- Verify `.env.example` compatibility

## Phase 3: Frontend Package Updates

### 3.1 Update package.json (Root)

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.11.0",
    "@radix-ui/react-*": "latest stable versions",
    "@supabase/supabase-js": "^2.77.0",
    "@tanstack/react-query": "^5.84.0",
    "axios": "^1.13.1",
    "framer-motion": "^11.12.0",
    "lucide-react": "^0.468.0",
    "react-router-dom": "^6.31.0",
    "zod": "^3.26.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.2.0",
    "eslint": "^9.33.0",
    "i18next": "^25.7.0",
    "react-i18next": "^16.3.0",
    "tailwindcss": "^4.1.16",
    "typescript": "^5.9.0",
    "vite": "^6.0.0"
  }
}
```

### 3.2 Handle Breaking Changes

- Update Tailwind CSS v4 config if needed (new config format)
- Verify Vite v6 compatibility with plugins
- Check TypeScript v5.9 strict mode impacts
- Update ESLint v9 flat config if needed

## Phase 4: Installation & Testing

### 4.1 Clean Install Backend

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### 4.2 Clean Install Frontend

```bash
rm -rf node_modules package-lock.json
npm install
```

### 4.3 Compile Check

```bash
cd backend && npm run typecheck
cd .. && npm run build
```

## Phase 5: Rigorous Testing Protocol

### 5.1 Backend API Tests

- Start backend: `npm --prefix backend run dev`
- Test `/api/health` endpoint
- Test authenticated endpoints with mock session
- Test OpenAI integration:
  - Call `/api/ai/recommendations`
  - Call `/api/ai/insights`
  - Call `/api/scenarios/simulate`
- Verify GPT-5 Nano model is being used
- Check all route handlers work with Express v5

### 5.2 Frontend Integration Tests

- Start frontend: `npm run dev`
- Test all pages load without errors:
  - Health (Dashboard)
  - Play
  - Rewards
  - Achievements
  - Profile
  - Social
  - Scenarios
- Test i18n language switching (en/ar)
- Test Toast notifications
- Test all API calls from frontend

### 5.3 End-to-End User Flows

1. Load dashboard → verify LifeScore displays
2. Navigate to Play → start mission → complete mission
3. Navigate to Rewards → check bundle calculator
4. Switch language → verify Arabic RTL layout
5. Check Achievements → verify loading/empty states
6. Test scenario simulation with AI
7. Verify all cultural theming elements render

### 5.4 Error Handling Validation

- Test API failures → verify error messages
- Test network errors → verify fallbacks
- Test missing data → verify empty states
- Check console for deprecation warnings

## Phase 6: Diagnosis & Fixes

### 6.1 Common Issues & Resolutions

**OpenAI v6 Issues:**

- If import fails → check default vs named export
- If model not found → verify GPT-5 Nano availability
- If auth fails → check API key format in v6

**Express v5 Issues:**

- If middleware breaks → update to 4-param pattern
- If routes 404 → check mounting syntax
- If CORS fails → verify corsOptions structure

**Frontend Issues:**

- If Radix UI breaks → check prop name changes
- If build fails → check Vite v6 config
- If TypeScript errors → update type definitions

### 6.2 Rollback Strategy (If Needed)

- Keep `package.json.backup` before changes
- Document all code modifications
- If critical failure: revert package.json and reinstall

## Phase 7: Final Validation

### 7.1 Production Build Test

```bash
npm run build
npm run preview
```

- Verify build succeeds
- Test production bundle
- Check bundle size (should not increase >20%)

### 7.2 Documentation Updates

- Update README with new package versions
- Document any API changes
- Update env.example if new vars needed

### 7.3 Commit Strategy

- Commit backend updates separately
- Commit frontend updates separately
- Clear commit messages documenting changes

## Success Criteria

- All packages updated to target versions
- GPT-5 Nano model confirmed working
- Zero breaking changes in user experience
- All pages render correctly
- All API endpoints functional
- i18n working in both languages
- No console errors or warnings
- Build completes successfully

### To-dos

- [ ] Research OpenAI v6 breaking changes and GPT-5 Nano compatibility
- [ ] Research Express v5 migration guide and middleware compatibility
- [ ] Map all dependency chains and check for conflicts
- [ ] Update backend/package.json with new versions
- [ ] Refactor ai.service.js for OpenAI v6 API
- [ ] Update Express v5 patterns in server.js and middleware
- [ ] Update root package.json with new versions
- [ ] Clean install backend dependencies
- [ ] Clean install frontend dependencies
- [ ] Test all backend endpoints with upgraded packages
- [ ] Test all frontend pages and interactions
- [ ] Test complete user flows end-to-end
- [ ] Diagnose and fix any compatibility issues
- [ ] Test production build and verify bundle