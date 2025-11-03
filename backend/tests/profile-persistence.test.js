/**
 * Profile Persistence Tests
 * Tests profile save, retrieval, and persistence across sessions
 */

export async function testProfilePersistence(apiBase, userId) {
  const errors = [];

  const testProfile = {
    name: 'Persistence Test User',
    age: 35,
    gender: 'female',
    nationality: 'Saudi',
    budget: 10000,
    insurance_preferences: ['health', 'travel', 'home'],
    vulnerabilities: ['frequent_travel', 'health_concerns'],
    areas_of_interest: ['wellness', 'family_protection']
  };

  // Test 1: Save profile
  console.log('  Testing profile save...');
  try {
    const saveRes = await fetch(`${apiBase}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-session-id': userId, 'x-user-id': userId },
      body: JSON.stringify({ profile_json: testProfile })
    });

    if (!saveRes.ok) {
      const errorData = await saveRes.json().catch(() => ({ message: saveRes.statusText }));
      throw new Error(`Save failed: ${errorData.message || saveRes.statusText}`);
    }

    const saveData = await saveRes.json();
    if (!saveData.success && saveData.success !== undefined) {
      errors.push('Profile save response indicates failure');
    }
  } catch (error) {
    errors.push(`Profile save failed: ${error.message}`);
    return;
  }

  // Test 2: Retrieve profile immediately
  console.log('  Testing immediate profile retrieval...');
  try {
    const getRes = await fetch(`${apiBase}/profile`, {
      headers: { 'x-session-id': userId, 'x-user-id': userId }
    });

    if (!getRes.ok) {
      throw new Error(`Get failed: ${getRes.statusText}`);
    }

    const profileData = await getRes.json();
    const userProfile = profileData?.userProfile || profileData;
    const profileJson = userProfile?.profile_json || {};

    // Verify all fields persisted
    const fieldsToCheck = ['name', 'age', 'gender', 'nationality', 'budget', 'insurance_preferences', 'vulnerabilities'];
    fieldsToCheck.forEach(field => {
      if (field === 'insurance_preferences' || field === 'vulnerabilities') {
        if (!Array.isArray(profileJson[field]) || profileJson[field].length === 0) {
          errors.push(`Field ${field} not persisted as array or is empty`);
        }
      } else if (profileJson[field] === undefined || profileJson[field] === null) {
        errors.push(`Field ${field} not persisted`);
      } else if (field === 'age' && profileJson[field] !== testProfile[field]) {
        errors.push(`Field ${field} value mismatch: expected ${testProfile[field]}, got ${profileJson[field]}`);
      } else if (field === 'name' && profileJson[field] !== testProfile[field]) {
        errors.push(`Field ${field} value mismatch: expected "${testProfile[field]}", got "${profileJson[field]}"`);
      }
    });
  } catch (error) {
    errors.push(`Profile retrieval failed: ${error.message}`);
  }

  // Test 3: Update profile and verify merge
  console.log('  Testing profile update (merge)...');
  try {
    const updateData = {
      profile_json: {
        budget: 15000,
        new_field: 'test_value'
      }
    };

    await fetch(`${apiBase}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-session-id': userId, 'x-user-id': userId },
      body: JSON.stringify(updateData)
    });

    const getRes = await fetch(`${apiBase}/profile`, {
      headers: { 'x-session-id': userId, 'x-user-id': userId }
    });

    const profileData = await getRes.json();
    const profileJson = (profileData?.userProfile || profileData)?.profile_json || {};

    // Verify merge (old fields still exist, new field added, budget updated)
    if (profileJson.name !== testProfile.name) {
      errors.push('Profile merge failed: name field lost');
    }
    if (profileJson.budget !== 15000) {
      errors.push(`Profile merge failed: budget not updated (expected 15000, got ${profileJson.budget})`);
    }
    if (profileJson.new_field !== 'test_value') {
      errors.push('Profile merge failed: new field not added');
    }
  } catch (error) {
    errors.push(`Profile update test failed: ${error.message}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  console.log('  ✅ All Profile Persistence tests passed');
}

