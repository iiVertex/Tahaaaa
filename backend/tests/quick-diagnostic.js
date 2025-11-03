#!/usr/bin/env node

/**
 * Quick Diagnostic Script
 * Tests each broken feature and reports exact issues
 */

const API_BASE = 'http://localhost:3001/api';
const TEST_USER = 'test-user-' + Date.now();

async function diagnostic() {
  console.log('\n🔍 Running Quick Diagnostics...\n');
  console.log(`Backend: ${API_BASE}`);
  console.log(`Test User: ${TEST_USER}\n`);

  const issues = [];

  // Test 1: Check backend health
  console.log('1️⃣  Checking backend health...');
  try {
    // Try health endpoint first
    let res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      console.log('   ✅ Backend is running\n');
    } else {
      // Try root endpoint as fallback
      res = await fetch(`${API_BASE}/..`, { signal: AbortSignal.timeout(5000) });
      if (res.status !== 404) {
        console.log('   ✅ Backend is running (health endpoint may not exist)\n');
      } else {
        issues.push('Backend health check failed');
        console.log('   ❌ Backend health check failed\n');
      }
    }
  } catch (error) {
    issues.push('Backend not running - start with: npm run dev in backend folder');
    console.log('   ❌ Backend not accessible:', error.message, '\n');
    console.log('   ⚠️  Start backend in a separate terminal: cd backend && npm run dev\n');
    console.log('   ⚠️  Then run diagnostics again: npm run test:quick\n');
    // Continue anyway to show what would be tested
  }

  // Test 2: Profile save and retrieve
  console.log('2️⃣  Testing profile persistence...');
  const testProfile = {
    name: 'Diagnostic User',
    age: 30,
    gender: 'male',
    nationality: 'Qatari',
    budget: 5000,
    insurance_preferences: ['car', 'health']
  };

  try {
    // Save
    const saveRes = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-session-id': TEST_USER },
      body: JSON.stringify({ profile_json: testProfile })
    });

    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({ message: saveRes.statusText }));
      issues.push(`Profile save failed: ${err.message}`);
      console.log('   ❌ Profile save failed:', err.message, '\n');
    } else {
      console.log('   ✅ Profile saved\n');
    }

    // Retrieve
    const getRes = await fetch(`${API_BASE}/profile`, {
      headers: { 'x-session-id': TEST_USER }
    });

    if (getRes.ok) {
      const profile = await getRes.json();
      const profileJson = (profile?.userProfile || profile)?.profile_json || {};
      
      if (profileJson.name !== testProfile.name) {
        issues.push('Profile not persisted - name mismatch');
        console.log('   ❌ Profile not persisted correctly\n');
      } else {
        console.log('   ✅ Profile retrieved correctly\n');
      }
    } else {
      issues.push('Profile retrieval failed');
      console.log('   ❌ Profile retrieval failed\n');
    }
  } catch (error) {
    issues.push(`Profile test error: ${error.message}`);
    console.log('   ❌ Profile test error:', error.message, '\n');
  }

  // Test 3: AI Simulate
  console.log('3️⃣  Testing AI Simulate...');
  try {
    const scenarioPayload = {
      category: 'Travel',
      scenario_description: 'Planning an Umrah trip, may need car and health insurance',
      user_profile: testProfile
    };

    const res = await fetch(`${API_BASE}/ai/scenarios/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': TEST_USER },
      body: JSON.stringify(scenarioPayload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      issues.push(`AI Simulate failed: ${err.message}`);
      console.log('   ❌ AI Simulate failed:', err.message, '\n');
    } else {
      const data = await res.json();
      const prediction = data.data || data;
      
      console.log('   Response structure:', {
        hasSuccess: !!data.success,
        hasData: !!data.data,
        hasScenarios: !!prediction.scenarios,
        scenariosCount: prediction.scenarios?.length || 0,
        hasBestPlan: !!prediction.best_plan,
        hasRecommendedPlans: !!prediction.recommended_plans
      });

      if (!prediction.scenarios || prediction.scenarios.length === 0) {
        issues.push('AI Simulate: No scenarios returned');
        console.log('   ❌ No scenarios in response\n');
      } else {
        console.log(`   ✅ Scenarios returned: ${prediction.scenarios.length}\n`);
      }

      if (!prediction.best_plan) {
        issues.push('AI Simulate: No best_plan returned');
        console.log('   ❌ No best_plan in response\n');
      } else {
        console.log('   ✅ best_plan returned:', prediction.best_plan.plan_name || 'unnamed', '\n');
      }
    }
  } catch (error) {
    issues.push(`AI Simulate test error: ${error.message}`);
    console.log('   ❌ AI Simulate test error:', error.message, '\n');
  }

  // Test 4: Mission start
  console.log('4️⃣  Testing mission start...');
  try {
    // Get missions first
    const missionsRes = await fetch(`${API_BASE}/missions`, {
      headers: { 'x-session-id': TEST_USER }
    });

    if (missionsRes.ok) {
      const missionsData = await missionsRes.json();
      const missions = missionsData?.data?.missions || missionsData?.missions || missionsData || [];
      
      if (missions.length > 0) {
        const testMission = missions[0];
        console.log(`   Testing with mission: ${testMission.id || 'unknown'}`);

        const startRes = await fetch(`${API_BASE}/missions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-id': TEST_USER },
          body: JSON.stringify({ missionId: testMission.id })
        });

        if (!startRes.ok) {
          const err = await startRes.json().catch(() => ({ message: startRes.statusText }));
          if (err.message.includes('Profile incomplete')) {
            issues.push('Mission start blocked by profile (should not block)');
            console.log('   ❌ Mission start blocked by profile requirement\n');
          } else {
            console.log('   ⚠️  Mission start:', err.message, '\n');
          }
        } else {
          const startData = await startRes.json();
          const steps = startData?.data?.steps || startData?.steps || [];
          if (steps.length === 0) {
            issues.push('Mission start: No steps generated');
            console.log('   ❌ No steps generated\n');
          } else {
            console.log(`   ✅ Steps generated: ${steps.length}\n`);
          }
        }
      } else {
        issues.push('No missions available to test');
        console.log('   ⚠️  No missions available\n');
      }
    }
  } catch (error) {
    issues.push(`Mission test error: ${error.message}`);
    console.log('   ❌ Mission test error:', error.message, '\n');
  }

  // Summary
  console.log('\n📋 Diagnostic Summary:');
  if (issues.length === 0) {
    console.log('✅ No issues found - all features working!\n');
  } else {
    console.log(`❌ Found ${issues.length} issues:\n`);
    issues.forEach((issue, idx) => {
      console.log(`   ${idx + 1}. ${issue}`);
    });
    console.log();
  }
}

diagnostic().catch(error => {
  console.error('Fatal diagnostic error:', error);
  process.exit(1);
});

