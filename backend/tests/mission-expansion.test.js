/**
 * Mission Expansion Feature Tests
 * Tests mission start, step generation, ChallengeView data, expansion
 */

export async function testMissionExpansion(apiBase, userId) {
  const errors = [];

  // Setup: Ensure profile exists
  const profileData = {
    name: 'Test User',
    age: 30,
    gender: 'male',
    nationality: 'Qatari',
    budget: 5000,
    insurance_preferences: ['car']
  };

  try {
    await fetch(`${apiBase}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-session-id': userId, 'x-user-id': userId },
      body: JSON.stringify({ profile_json: profileData })
    });
  } catch (e) {
    console.warn('  ⚠️  Profile setup warning:', e.message);
  }

  // Test 1: Get available missions
  console.log('  Fetching available missions...');
  let missions = [];
  try {
    const missionsRes = await fetch(`${apiBase}/missions`, {
      headers: { 'x-session-id': userId, 'x-user-id': userId }
    });
    if (missionsRes.ok) {
      const data = await missionsRes.json();
      missions = data?.data?.missions || data?.missions || data || [];
      if (missions.length === 0) {
        // Try generating missions
        console.log('  No missions found, generating...');
        const genRes = await fetch(`${apiBase}/missions/generate`, {
          method: 'POST',
          headers: { 'x-session-id': userId, 'x-user-id': userId }
        });
        if (genRes.ok) {
          const genData = await genRes.json();
          missions = genData?.data?.missions || genData?.missions || [];
        }
      }
    }
  } catch (error) {
    errors.push(`Failed to get missions: ${error.message}`);
    return;
  }

  if (missions.length === 0) {
    errors.push('No missions available to test');
    return;
  }

  const testMission = missions[0];
  console.log(`  Testing with mission: ${testMission.id || testMission.title_en || 'Unknown'}`);

  // Test 2: Start mission
  console.log('  Testing mission start...');
  try {
    const startRes = await fetch(`${apiBase}/missions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': userId, 'x-user-id': userId },
      body: JSON.stringify({ missionId: testMission.id })
    });

    if (!startRes.ok) {
      const errorData = await startRes.json().catch(() => ({ message: startRes.statusText }));
      const errorMsg = errorData.message || startRes.statusText;
      
      if (errorMsg.includes('already started') || errorMsg.includes('active')) {
        console.log('  ℹ️  Mission already active, testing steps retrieval...');
      } else if (errorMsg.includes('Profile incomplete')) {
        errors.push('Mission start blocked by profile requirement (should not block)');
        return;
      } else {
        errors.push(`Mission start failed: ${errorMsg}`);
        return;
      }
    }

    const startData = await startRes.json();
    
    // Test 3: Verify steps are returned
    console.log('  Verifying mission steps...');
    const steps = startData?.data?.steps || startData?.steps || [];
    if (!Array.isArray(steps)) {
      errors.push('Steps not returned as array');
    } else if (steps.length === 0) {
      errors.push('No steps generated (expected 3 steps)');
    } else {
      // Verify step structure
      steps.forEach((step, idx) => {
        if (!step.title && !step.title_en) {
          errors.push(`Step ${idx + 1} missing title`);
        }
        if (!step.description && !step.description_en) {
          errors.push(`Step ${idx + 1} missing description`);
        }
      });
    }

    // Test 4: Get mission steps via dedicated endpoint
    console.log('  Testing mission steps endpoint...');
    const stepsRes = await fetch(`${apiBase}/missions/${testMission.id}/steps`, {
      headers: { 'x-session-id': userId, 'x-user-id': userId }
    });
    
    if (stepsRes.ok) {
      const stepsData = await stepsRes.json();
      const retrievedSteps = stepsData?.data?.steps || stepsData?.steps || [];
      if (retrievedSteps.length === 0 && steps.length === 0) {
        errors.push('Mission steps endpoint returned no steps');
      }
    }

  } catch (error) {
    errors.push(`Mission expansion test failed: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  console.log('  ✅ All Mission Expansion tests passed');
}

