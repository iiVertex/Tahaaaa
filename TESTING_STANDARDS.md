# Testing Standards - User Workflow Testing

## Core Principle

**Always test actual user workflows, not just API endpoints in isolation.**

## What This Means

### ❌ DON'T: Test Endpoints in Isolation
```javascript
// BAD: Only tests that endpoint returns 200
test('/api/health returns 200', async () => {
  const res = await client.get('/health');
  expect(res.status).toBe(200);
});
```

### ✅ DO: Test Complete User Workflows
```javascript
// GOOD: Tests actual user journey
test('User simulates scenario on Showcase page', async () => {
  // Step 1: User navigates to Showcase
  await navigateTo('/showcase');
  
  // Step 2: Page loads dependencies
  await verifyProfileLoaded();
  await verifyRecommendationsLoaded();
  
  // Step 3: User fills form
  await fillScenarioForm({ category: 'auto', text: '...' });
  
  // Step 4: User clicks Simulate
  await clickSimulate();
  
  // Step 5: Verify result renders without crashing
  await verifyResultDisplayed();
  await verifyNullSafety(); // Check optional chaining works
});
```

## Required Test Categories

### 1. End-to-End Workflows
Test complete user journeys:
- Scenario simulation (Showcase page)
- Mission start/complete flow
- Product bundle calculation
- Page navigation with data loading

### 2. Error Resilience
Test what happens when things go wrong:
- 400 validation errors
- 429 rate limiting
- Null/undefined in API responses
- Network failures

### 3. Component Safety
Verify components handle edge cases:
- Null/undefined data
- Empty arrays
- Missing fields
- Wrong data types

### 4. Real User Interactions
Simulate actual clicks and form submissions:
- Button clicks
- Form submissions
- Navigation between pages
- Loading states

## Testing Checklist

Before considering any feature "tested", verify:

- [ ] Complete user workflow tested (not just endpoints)
- [ ] Error cases handled (400, 429, network failures)
- [ ] Null/undefined safety verified
- [ ] Component renders without crashing
- [ ] Loading states work correctly
- [ ] Success states display properly
- [ ] Error messages shown to user
- [ ] Fallback mechanisms work

## Test Scripts

- `npm run test:e2e` - End-to-end workflow testing
- `npm run test:interactions` - User interaction simulation
- `npm run test:workflows` - Run all workflow tests

## Examples

### Scenario Simulation Workflow Test
```javascript
1. Load /showcase page
2. Verify profile loads (prerequisite)
3. Verify AI recommendations load (prerequisite)
4. Test POST /ai/recommendations with context (what Showcase actually does)
5. If 400/429, verify fallback to GET works
6. Submit scenario simulation
7. Verify response structure matches component expectations
8. Verify null-safety: result?.suggested_missions won't crash
```

### Mission Start Flow Test
```javascript
1. Load /missions page
2. Verify missions list loads
3. Click "Start" on first mission
4. Verify API call succeeds
5. Verify UI updates (if applicable)
6. Test completion flow
```

## Why This Approach Matters

1. **Catches Real Bugs**: Testing workflows finds issues that endpoint tests miss
2. **Validates Data Flow**: Ensures data flows correctly through the entire system
3. **Prevents Crashes**: Verifies components handle edge cases gracefully
4. **User-Centric**: Tests what users actually experience

## Remember

Every test should answer: **"Would this work for a real user?"**

Not just: **"Does this endpoint return 200?"**

