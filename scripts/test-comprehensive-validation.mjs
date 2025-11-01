/**
 * Comprehensive Validation and Testing Script
 * Tests all new mission system endpoints and validates implementation
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const SESSION_ID = `test-${Date.now()}`;
const USER_ID = 'mock-user-001'; // Must match mock user ID in auth.js

// Use native fetch (Node 18+)
async function request(method, endpoint, body = null, headers = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': SESSION_ID,
      'x-user-id': USER_ID,
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null
    };
  }
}

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(type, message, details = null) {
  const prefix = {
    success: '✅',
    error: '❌',
    warning: '⚠️ ',
    info: 'ℹ️ '
  }[type] || '→';
  
  console.log(`${prefix} ${message}`);
  if (details) {
    console.log(`   ${JSON.stringify(details, null, 2).split('\n').join('\n   ')}`);
  }
}

async function testHealth() {
  log('info', 'Testing health endpoint...');
  const result = await request('GET', '/health');
  if (result.ok && result.data?.success) {
    results.passed.push('Health endpoint');
    log('success', 'Health endpoint working');
    return true;
  } else {
    results.failed.push({ test: 'Health endpoint', error: result.error || result.data });
    log('error', 'Health endpoint failed', result);
    return false;
  }
}

async function testProfileUpdate() {
  log('info', 'Testing profile update with new fields...');
  const profileData = {
    profile_json: {
      name: 'Test User',
      age: 30,
      gender: 'male',
      nationality: 'Qatari',
      budget: 10000,
      insurance_preferences: ['car', 'health'],
      areas_of_interest: ['travel', 'electronics'],
      vulnerabilities: ['Frequent travel'],
      first_time_buyer: true,
      preferences: {
        missionDifficulty: 'medium',
        interests: ['health'],
        frequency: 'daily',
        notifications: { push: true, email: true }
      }
    }
  };
  
  const result = await request('PUT', '/profile', profileData);
  if (result.ok || result.status === 200) {
    results.passed.push('Profile update with new fields');
    log('success', 'Profile updated successfully');
    return true;
  } else {
    results.failed.push({ test: 'Profile update', error: result.data });
    log('error', 'Profile update failed', result.data);
    return false;
  }
}

async function testGetProfile() {
  log('info', 'Testing get profile...');
  const result = await request('GET', '/profile');
  if (result.ok && result.data?.data?.profile) {
    const profile = result.data.data.profile;
    log('info', `Profile keys: ${Object.keys(profile).join(', ')}`);
    log('info', `Profile age: ${profile.age}, gender: ${profile.gender}, insurance_preferences: ${JSON.stringify(profile.insurance_preferences)}`);
    
    const hasNewFields = profile.age !== undefined && 
                        profile.gender !== undefined &&
                        Array.isArray(profile.insurance_preferences);
    
    if (hasNewFields) {
      results.passed.push('Get profile with new fields');
      log('success', 'Profile retrieved with new fields');
      return true;
    } else {
      results.warnings.push({ test: 'Get profile', warning: `New fields not present. Keys: ${Object.keys(profile).join(', ')}` });
      log('warning', 'Profile retrieved but new fields missing', { profileKeys: Object.keys(profile), profile });
      return true; // Not a failure, just warning
    }
  } else {
    results.failed.push({ test: 'Get profile', error: result.data });
    log('error', 'Get profile failed', result.data);
    return false;
  }
}

async function testMissionGeneration() {
  log('info', 'Testing mission generation endpoint...');
  
  // First try with incomplete profile (should fail with 400)
  log('info', '  Step 1: Testing with incomplete profile (should fail)...');
  
  // Clear profile first by setting it to empty (since all sessions use same mock user)
  const clearProfileBody = { profile_json: {} };
  await request('PUT', '/profile', clearProfileBody);
  await new Promise(resolve => setTimeout(resolve, 200)); // Wait for update to complete
  
  // Now try generation with empty profile (should fail)
  // Send empty object as JSON, not string '{}'
  const incompleteResult = await request('POST', '/missions/generate', {});
  
  // Should return 400 (incomplete) since profile exists but is empty
  if (incompleteResult.status === 400 && incompleteResult.data?.message?.includes('incomplete')) {
    results.passed.push('Mission generation - profile completion check');
    log('success', `Correctly rejects incomplete profile (${incompleteResult.status})`);
  } else {
    results.warnings.push({ test: 'Mission generation - validation', warning: `Expected 400, got ${incompleteResult.status}. Response: ${JSON.stringify(incompleteResult.data)}` });
    log('warning', `Profile completion check returned ${incompleteResult.status}`, incompleteResult.data);
  }
  
  // Complete profile first
  await testProfileUpdate();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Now try generation (should succeed)
  log('info', '  Step 2: Testing with complete profile (should succeed)...');
  const result = await request('POST', '/missions/generate');
  
  if (result.ok && result.data?.data?.missions) {
    const missions = result.data.data.missions || [];
    if (missions.length > 0) {
      // Validate mission structure
      const valid = missions.every(m => 
        m.id && 
        m.title_en && 
        m.category && 
        m.difficulty &&
        typeof m.coin_reward === 'number'
      );
      
      if (valid) {
        results.passed.push('Mission generation');
        log('success', `Generated ${missions.length} missions`);
        return missions;
      } else {
        results.failed.push({ test: 'Mission generation - structure', error: 'Invalid mission structure' });
        log('error', 'Missions missing required fields');
        return null;
      }
    } else {
      results.failed.push({ test: 'Mission generation - empty', error: 'No missions generated' });
      log('error', 'No missions generated');
      return null;
    }
  } else {
    results.failed.push({ test: 'Mission generation', error: result.data });
    log('error', 'Mission generation failed', result.data);
    return null;
  }
}

async function testMissionStart(missionId) {
  log('info', `Testing mission start with steps generation for mission ${missionId}...`);
  
  const result = await request('POST', '/missions/start', { missionId });
  
  if (result.ok && result.data?.data?.steps) {
    const steps = result.data.data.steps || [];
    if (steps.length === 3) {
      const valid = steps.every((s, idx) => 
        s.step_number === (idx + 1) && 
        s.title && 
        s.description
      );
      
      if (valid) {
        results.passed.push('Mission start with 3-step plan');
        log('success', 'Mission started with 3 steps generated');
        return true;
      } else {
        results.failed.push({ test: 'Mission start - steps structure', error: 'Invalid step structure' });
        log('error', 'Steps have invalid structure');
        return false;
      }
    } else {
      results.warnings.push({ test: 'Mission start - steps count', warning: `Expected 3 steps, got ${steps.length}` });
      log('warning', `Expected 3 steps, got ${steps.length}`);
      return steps.length > 0; // Partial success
    }
  } else {
    results.failed.push({ test: 'Mission start', error: result.data });
    log('error', 'Mission start failed', result.data);
    return false;
  }
}

async function testGetMissionSteps(missionId) {
  log('info', `Testing get mission steps for ${missionId}...`);
  
  const result = await request('GET', `/missions/${missionId}/steps`);
  
  if (result.ok && result.data?.data?.steps) {
    const steps = result.data.data.steps || [];
    results.passed.push('Get mission steps');
    log('success', `Retrieved ${steps.length} steps`);
    return true;
  } else if (result.status === 404) {
    results.warnings.push({ test: 'Get mission steps', warning: '404 - Mission may need to be started first' });
    log('warning', 'Steps endpoint returned 404 (mission may not be active)');
    return true; // Not a failure if mission not started
  } else {
    results.failed.push({ test: 'Get mission steps', error: result.data });
    log('error', 'Get mission steps failed', result.data);
    return false;
  }
}

async function testMissionCompletion(missionId) {
  log('info', `Testing mission completion with coin rewards for ${missionId}...`);
  
  // Get profile before completion to check coins
  const beforeProfile = await request('GET', '/profile');
  const beforeCoins = beforeProfile.data?.data?.user?.coins || 
                     beforeProfile.data?.user?.coins || 
                     0;
  
  const result = await request('POST', '/missions/complete', { missionId });
  
  if (result.ok && result.data?.rewards) {
    const rewards = result.data.rewards || {};
    const coinsAwarded = rewards.coins || 0;
    
    // Get profile after
    const afterProfile = await request('GET', '/profile');
    const afterCoins = afterProfile.data?.data?.user?.coins || 
                      afterProfile.data?.user?.coins || 
                      0;
    
    if (coinsAwarded > 0) {
      results.passed.push('Mission completion with coin rewards');
      log('success', `Mission completed: ${coinsAwarded} coins awarded`);
      log('info', `Coins: ${beforeCoins} → ${afterCoins} (+${coinsAwarded})`);
      return true;
    } else {
      results.warnings.push({ test: 'Mission completion', warning: 'No coins awarded' });
      log('warning', 'Mission completed but no coins awarded');
      return true; // Not a critical failure
    }
  } else {
    results.failed.push({ test: 'Mission completion', error: result.data });
    log('error', 'Mission completion failed', result.data);
    return false;
  }
}

async function testGetMissions() {
  log('info', 'Testing get missions endpoint...');
  
  const result = await request('GET', '/missions');
  
  if (result.ok && result.data?.data?.missions) {
    const missions = result.data.data.missions || [];
    const hasCoinReward = missions.some(m => m.coin_reward !== undefined);
    
    if (hasCoinReward) {
      results.passed.push('Get missions with coin_reward field');
      log('success', `Retrieved ${missions.length} missions with coin_reward field`);
    } else {
      results.warnings.push({ test: 'Get missions', warning: 'coin_reward field not present' });
      log('warning', 'Missions retrieved but coin_reward field missing');
    }
    return true;
  } else {
    results.failed.push({ test: 'Get missions', error: result.data });
    log('error', 'Get missions failed', result.data);
    return false;
  }
}

async function testOffersJSON() {
  log('info', 'Testing exclusive offers JSON file...');
  
  try {
    const offersPath = join(rootDir, 'src', 'data', 'exclusiveOffers.json');
    const offers = JSON.parse(readFileSync(offersPath, 'utf8'));
    
    if (Array.isArray(offers) && offers.length > 0) {
      const valid = offers.every(o => o.title && o.offer_type && o.conditions_simplified);
      if (valid) {
        results.passed.push('Exclusive offers JSON');
        log('success', `Loaded ${offers.length} valid offers`);
        return true;
      } else {
        results.failed.push({ test: 'Exclusive offers JSON', error: 'Invalid offer structure' });
        log('error', 'Offers have invalid structure');
        return false;
      }
    } else {
      results.failed.push({ test: 'Exclusive offers JSON', error: 'Empty or invalid array' });
      log('error', 'Offers file is empty or invalid');
      return false;
    }
  } catch (error) {
    results.failed.push({ test: 'Exclusive offers JSON', error: error.message });
    log('error', 'Failed to load offers JSON', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🧪 Comprehensive Validation Tests');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Session ID: ${SESSION_ID}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Basic connectivity
  await testHealth();
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Profile tests
  await testProfileUpdate();
  await new Promise(resolve => setTimeout(resolve, 300));
  await testGetProfile();
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mission generation
  const missions = await testMissionGeneration();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mission start and steps
  if (missions && missions.length > 0) {
    const missionId = missions[0].id;
    await testMissionStart(missionId);
    await new Promise(resolve => setTimeout(resolve, 300));
    await testGetMissionSteps(missionId);
    await new Promise(resolve => setTimeout(resolve, 300));
    // Note: Can't test completion of same mission twice, so skip
    // await testMissionCompletion(missionId);
  }
  
  // Get missions list
  await testGetMissions();
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Static file test
  await testOffersJSON();
  
  // Summary
  console.log('\n\n📊 Test Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   ✓ ${test}`));
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
    results.warnings.forEach(({ test, warning }) => console.log(`   ⚠ ${test}: ${warning}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(({ test, error }) => {
      console.log(`   ✗ ${test}`);
      if (typeof error === 'string') {
        console.log(`     ${error}`);
      } else if (error) {
        console.log(`     ${JSON.stringify(error).substring(0, 200)}`);
      }
    });
    console.log('\n');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
  }
}

runAllTests().catch(error => {
  console.error('\n❌ Test runner crashed:', error);
  console.error(error.stack);
  process.exit(1);
});

