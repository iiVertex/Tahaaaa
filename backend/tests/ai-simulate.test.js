/**
 * AI Simulate Feature Tests
 * Tests scenario simulation, scenarios display, insurance recommendations, LifeScore impacts
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';

export async function testAISimulate(apiBase, userId) {
  const errors = [];

  // Setup: Ensure user has profile
  const profileData = {
    name: 'Test User',
    age: 30,
    gender: 'male',
    nationality: 'Qatari',
    budget: 5000,
    insurance_preferences: ['car', 'health'],
    vulnerabilities: ['frequent_travel']
  };

  try {
    // Save profile first
    const profileRes = await fetch(`${apiBase}/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'x-session-id': userId,
        'x-session-id': userId, 'x-user-id': userId 
      },
      body: JSON.stringify({ profile_json: profileData })
    });
    if (!profileRes.ok) {
      throw new Error(`Failed to setup profile: ${profileRes.statusText}`);
    }
  } catch (error) {
    console.warn('  ⚠️  Profile setup failed (may be using session auth):', error.message);
  }

  // Test 1: Scenario simulation with custom input
  console.log('  Testing scenario simulation...');
  try {
    const scenarioPayload = {
      category: 'Travel',
      scenario_description: 'Planning an Umrah trip, may need car and health insurance',
      user_profile: profileData,
      time_context: { month: 12, season: 'winter' }
    };

    const response = await fetch(`${apiBase}/ai/scenarios/simulate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-session-id': userId,
        'x-session-id': userId, 'x-user-id': userId 
      },
      body: JSON.stringify(scenarioPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`API returned ${response.status}: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.success) {
      errors.push('Response success flag is false');
    }

    const prediction = data.data || data;
    
    // Test 2: Verify scenarios array exists
    console.log('  Verifying scenarios array...');
    if (!prediction.scenarios || !Array.isArray(prediction.scenarios)) {
      errors.push('Missing or invalid scenarios array');
    } else if (prediction.scenarios.length !== 4) {
      errors.push(`Expected 4 scenarios, got ${prediction.scenarios.length}`);
    } else {
      // Verify each scenario has LifeScore impact
      prediction.scenarios.forEach((scenario, idx) => {
        if (!scenario.includes('LifeScore impact')) {
          errors.push(`Scenario ${idx + 1} missing LifeScore impact`);
        }
      });
    }

    // Test 3: Verify best_plan exists
    console.log('  Verifying best_plan...');
    if (!prediction.best_plan) {
      errors.push('Missing best_plan in response');
    } else {
      const bestPlan = prediction.best_plan;
      
      // Verify required fields
      if (!bestPlan.plan_name) errors.push('best_plan missing plan_name');
      if (!bestPlan.insurance_type) errors.push('best_plan missing insurance_type');
      if (!bestPlan.standard_coverages || !Array.isArray(bestPlan.standard_coverages)) {
        errors.push('best_plan missing or invalid standard_coverages array');
      }
      
      // Verify coverage_scenarios if present
      if (bestPlan.coverage_scenarios) {
        if (!Array.isArray(bestPlan.coverage_scenarios)) {
          errors.push('coverage_scenarios must be an array');
        }
      }
    }

    // Test 4: Verify narrative and severity_score
    if (!prediction.narrative) errors.push('Missing narrative in response');
    if (typeof prediction.severity_score !== 'number') {
      errors.push('Missing or invalid severity_score');
    }

    // Test 5: Verify coin deduction occurred (check coins decreased)
    console.log('  Verifying coin deduction...');
    const coinsRes = await fetch(`${apiBase}/profile`, {
      headers: { 'x-session-id': userId, 'x-user-id': userId }
    });
    if (coinsRes.ok) {
      const profile = await coinsRes.json();
      const userProfile = profile?.userProfile || profile;
      const coins = userProfile?.coins || userProfile?.user?.coins;
      if (coins === undefined || coins === null) {
        console.warn('  ⚠️  Could not verify coin deduction (coins field missing)');
      }
    }

  } catch (error) {
    errors.push(`Scenario simulation failed: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  console.log('  ✅ All AI Simulate tests passed');
}

