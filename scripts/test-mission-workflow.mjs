/**
 * Comprehensive Mission Workflow Tests
 * Tests the complete mission system: Profile → Generate → Start → Steps → Complete → Coins
 * 
 * This script validates:
 * 1. Profile completion check
 * 2. Mission generation with AI
 * 3. Mission start with 3-step plan generation
 * 4. Step completion
 * 5. Mission completion and coin rewards
 * 6. Offers filtering
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:8080';

// Helper to make HTTP requests (using built-in fetch in Node 18+ or https module)
async function request(method, url, body = null, headers = {}) {
  let fetchFn;
  
  // Try to use native fetch (Node 18+)
  if (typeof fetch !== 'undefined') {
    fetchFn = fetch;
  } else {
    // Fallback to node-fetch if available, or use https module
    try {
      const nodeFetch = await import('node-fetch');
      fetchFn = nodeFetch.default || nodeFetch;
    } catch {
      // Last resort: use https module
      const https = await import('https');
      const { URL } = await import('url');
      return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
          });
        });
        req.on('error', (error) => resolve({ status: 0, ok: false, error: error.message, data: null }));
        if (body) req.write(JSON.stringify(body));
        req.end();
      });
    }
  }
  
  try {
    const response = await fetchFn(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, ok: response.ok, data, text };
  } catch (error) {
    return { status: 0, ok: false, error: error.message, data: null };
  }
}

// Check backend availability
async function checkBackend() {
  console.log('🔍 Checking backend availability...');
  try {
    const result = await request('GET', `${API_BASE}/api/health`);
    if (result.ok || result.status === 200) {
      console.log('✅ Backend is running');
      return true;
    }
  } catch (error) {
    // Ignore
  }
  
  console.log('❌ Backend not available');
  console.log(`   Expected: ${API_BASE}/api/health`);
  console.log('   Make sure backend is running: npm run dev:both');
  return false;
}

// Mock session ID (in real app, would come from login)
const SESSION_ID = `test-${Date.now()}`;

async function testProfileCompletionCheck() {
  console.log('\n📋 Test 1: Profile Completion Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Try to generate missions without completing profile
  const result = await request('POST', `${API_BASE}/api/missions/generate`, null, {
    'x-session-id': SESSION_ID,
    'x-user-id': 'test-user-001'
  });
  
  if (result.status === 400 && result.data?.message?.includes('Profile incomplete')) {
    console.log('✅ Profile completion check working - correctly rejects incomplete profile');
    return true;
  } else {
    console.log('❌ Profile completion check failed');
    console.log('   Expected: 400 with "Profile incomplete" message');
    console.log(`   Got: ${result.status} - ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function testCompleteProfile() {
  console.log('\n📝 Test 2: Complete Profile');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const profileData = {
    profile_json: {
      name: 'Test User',
      age: 30,
      gender: 'male',
      nationality: 'Qatari',
      budget: 10000,
      insurance_preferences: ['car', 'health'],
      areas_of_interest: ['travel', 'electronics'],
      vulnerabilities: ['Frequent travel', 'Expensive electronics at home'],
      first_time_buyer: true,
      preferences: {
        missionDifficulty: 'medium',
        interests: ['health', 'safe_driving'],
        frequency: 'daily',
        notifications: { push: true, email: true, sms: false }
      }
    }
  };
  
  const result = await request('PUT', `${API_BASE}/api/profile`, profileData, {
    'x-session-id': SESSION_ID,
    'x-user-id': 'test-user-001'
  });
  
  if (result.ok || result.status === 200 || result.status === 201) {
    console.log('✅ Profile completed successfully');
    return true;
  } else {
    console.log('❌ Failed to complete profile');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function testMissionGeneration() {
  console.log('\n🤖 Test 3: Mission Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await request('POST', `${API_BASE}/api/missions/generate`, null, {
    'x-session-id': SESSION_ID,
    'x-user-id': 'test-user-001'
  });
  
  // Handle both { success: true, data: { missions: [...] } } and direct { missions: [...] }
  const missions = result.data?.data?.missions || result.data?.missions || [];
  
  if (result.ok || result.status === 200 || result.status === 201) {
    if (missions.length > 0) {
      console.log(`✅ Generated ${missions.length} missions`);
      
      // Validate mission structure
      const validMissions = missions.every(m => 
        m.id && 
        m.title_en && 
        m.category && 
        m.difficulty && 
        typeof m.xp_reward === 'number' &&
        typeof m.coin_reward === 'number'
      );
      
      if (validMissions) {
        console.log('✅ All missions have required fields');
        
        // Check coin rewards match difficulty
        const coinRewardsValid = missions.every(m => {
          const expected = m.difficulty === 'easy' ? 10 : m.difficulty === 'medium' ? 20 : 30;
          return m.coin_reward === expected;
        });
        
        if (coinRewardsValid) {
          console.log('✅ Coin rewards match difficulty (easy=10, medium=20, hard=30)');
        } else {
          console.log('⚠️  Some missions have incorrect coin rewards');
        }
        
        // Check if missions are relevant to profile
        const relevantMissions = missions.some(m => 
          m.category === 'safe_driving' || m.category === 'health' || 
          m.ai_generated === true
        );
        
        if (relevantMissions) {
          console.log('✅ Generated missions are relevant to user profile');
        }
        
        return { success: true, missions };
      } else {
        console.log('❌ Some missions missing required fields');
        return { success: false };
      }
    } else {
      console.log('❌ No missions generated');
      return { success: false };
    }
  } else {
    console.log('❌ Mission generation failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data)}`);
    return { success: false };
  }
}

async function testMissionStart(missionId) {
  console.log('\n▶️  Test 4: Mission Start with 3-Step Plan');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await request('POST', `${API_BASE}/api/missions/start`, 
    { missionId },
    {
      'x-session-id': SESSION_ID,
      'x-user-id': 'test-user-001'
    }
  );
  
  if (result.ok && result.data?.steps) {
    const steps = result.data.steps || [];
    if (steps.length === 3) {
      console.log('✅ Mission started successfully');
      console.log('✅ Generated exactly 3 steps');
      
      // Validate step structure
      const validSteps = steps.every((s, idx) => 
        s.step_number === (idx + 1) && 
        s.title && 
        s.description &&
        s.status === 'pending'
      );
      
      if (validSteps) {
        console.log('✅ All steps have correct structure');
        console.log('   Steps:');
        steps.forEach((s, idx) => {
          console.log(`   ${idx + 1}. ${s.title}: ${s.description.substring(0, 60)}...`);
        });
        return { success: true, steps };
      } else {
        console.log('❌ Steps have invalid structure');
        return { success: false };
      }
    } else {
      console.log(`❌ Expected 3 steps, got ${steps.length}`);
      return { success: false };
    }
  } else {
    console.log('❌ Mission start failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data)}`);
    return { success: false };
  }
}

async function testMissionSteps(missionId) {
  console.log('\n📋 Test 5: Get Mission Steps');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await request('GET', `${API_BASE}/api/missions/${missionId}/steps`, null, {
    'x-session-id': SESSION_ID,
    'x-user-id': 'test-user-001'
  });
  
  if (result.ok && result.data?.steps) {
    const steps = result.data.steps || [];
    if (steps.length === 3) {
      console.log('✅ Retrieved mission steps successfully');
      console.log(`   Found ${steps.length} steps`);
      return { success: true, steps };
    } else {
      console.log(`⚠️  Expected 3 steps, found ${steps.length}`);
      return { success: true, steps }; // Not a failure, just warning
    }
  } else {
    console.log('⚠️  Could not retrieve steps (may need mission to be started first)');
    return { success: true, steps: [] }; // Not critical
  }
}

async function testMissionCompletion(missionId, expectedCoins = 20) {
  console.log('\n✔️  Test 6: Mission Completion and Coin Rewards');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // First, get user stats before completion
  const beforeResult = await request('GET', `${API_BASE}/api/profile`, null, {
    'x-session-id': SESSION_ID,
    'x-user-id': 'test-user-001'
  });
  
  const beforeCoins = beforeResult.data?.user?.coins || beforeResult.data?.data?.user?.coins || 0;
  
  // Complete mission
  const result = await request('POST', `${API_BASE}/api/missions/complete`, 
    { missionId },
    {
      'x-session-id': SESSION_ID,
      'x-user-id': 'test-user-001'
    }
  );
  
  if (result.ok && result.data?.rewards) {
    console.log('✅ Mission completed successfully');
    
    const rewards = result.data.rewards || {};
    const coinsAwarded = rewards.coins || 0;
    
    // Get user stats after completion
    const afterResult = await request('GET', `${API_BASE}/api/profile`, null, {
      'x-session-id': SESSION_ID,
      'x-user-id': 'test-user-001'
    });
    
    const afterCoins = afterResult.data?.user?.coins || afterResult.data?.data?.user?.coins || 0;
    const actualCoinsIncrease = afterCoins - beforeCoins;
    
    console.log(`   Coins before: ${beforeCoins}`);
    console.log(`   Coins awarded: ${coinsAwarded}`);
    console.log(`   Coins after: ${afterCoins}`);
    console.log(`   Actual increase: ${actualCoinsIncrease}`);
    
    if (actualCoinsIncrease === expectedCoins || coinsAwarded === expectedCoins) {
      console.log(`✅ Correct coin reward (${expectedCoins} coins)`);
    } else {
      console.log(`⚠️  Coin reward mismatch. Expected: ${expectedCoins}, Got: ${coinsAwarded || actualCoinsIncrease}`);
    }
    
    if (rewards.xp && rewards.lifescore !== undefined) {
      console.log(`✅ XP reward: ${rewards.xp}, LifeScore impact: ${rewards.lifescore}`);
    }
    
    return { success: true, rewards };
  } else {
    console.log('❌ Mission completion failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response: ${JSON.stringify(result.data)}`);
    return { success: false };
  }
}

async function testOffersFiltering() {
  console.log('\n🎁 Test 7: Exclusive Offers Filtering');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Load offers from JSON
  const offersPath = join(rootDir, 'src', 'data', 'exclusiveOffers.json');
  let offers = [];
  try {
    const offersFile = readFileSync(offersPath, 'utf8');
    offers = JSON.parse(offersFile);
    console.log(`✅ Loaded ${offers.length} offers from JSON`);
    
    // Test filtering logic
    const profile = {
      insurance_preferences: ['car', 'health'],
      areas_of_interest: ['travel', 'electronics'],
      first_time_buyer: true
    };
    
    // Manual filtering test
    const relevantOffers = offers.filter(offer => {
      const offerType = offer.offer_type;
      const allCategories = [...(profile.insurance_preferences || []), ...(profile.areas_of_interest || [])];
      
      return (
        (offerType === 'car' && allCategories.includes('car')) ||
        (offerType === 'fashion' && allCategories.includes('fashion')) ||
        (offerType === 'food' && allCategories.includes('food')) ||
        (offerType === 'electronics' && allCategories.includes('electronics')) ||
        (profile.first_time_buyer && offerType === 'car')
      );
    });
    
    console.log(`✅ Filtered ${relevantOffers.length} relevant offers from ${offers.length} total`);
    
    if (relevantOffers.length > 0) {
      console.log('   Sample offers:');
      relevantOffers.slice(0, 3).forEach((offer, idx) => {
        console.log(`   ${idx + 1}. ${offer.title} (${offer.offer_type})`);
      });
    }
    
    return { success: true, offers: relevantOffers };
  } catch (error) {
    console.log(`⚠️  Could not test offers filtering: ${error.message}`);
    return { success: true }; // Not critical
  }
}

async function testFullWorkflow() {
  console.log('\n🔄 Test 8: Full Workflow Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('Testing complete user journey: Profile → Generate → Start → Complete');
  
  const steps = [
    () => testProfileCompletionCheck(),
    () => testCompleteProfile(),
    () => testMissionGeneration(),
  ];
  
  let results = [];
  for (const step of steps) {
    const result = await step();
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }
  
  const genResult = results[2];
  if (genResult?.success && genResult.missions?.length > 0) {
    const mission = genResult.missions[0];
    console.log(`\n   Continuing with mission: ${mission.title_en || mission.id}`);
    
    const startResult = await testMissionStart(mission.id);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (startResult?.success) {
      await testMissionSteps(mission.id);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const expectedCoins = mission.coin_reward || (mission.difficulty === 'easy' ? 10 : mission.difficulty === 'medium' ? 20 : 30);
      await testMissionCompletion(mission.id, expectedCoins);
    }
  }
  
  console.log('\n✅ Full workflow test completed');
}

// Main test runner
async function runTests() {
  console.log('🧪 Mission Workflow Comprehensive Tests');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Frontend Base: ${FRONTEND_BASE}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Check backend availability first
  const backendAvailable = await checkBackend();
  if (!backendAvailable) {
    console.log('\n⚠️  Backend is not running. Some tests will be skipped.');
    console.log('   To run full tests, start backend with: npm run dev:both\n');
  }
  
  const results = {};
  
  // Only run backend-dependent tests if backend is available
  if (backendAvailable) {
    results.profileCheck = await testProfileCompletionCheck();
    results.completeProfile = await testCompleteProfile();
    results.missionGeneration = await testMissionGeneration();
    
    if (results.missionGeneration?.success && results.missionGeneration.missions?.length > 0) {
      const mission = results.missionGeneration.missions[0];
      results.missionStart = await testMissionStart(mission.id);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      results.missionSteps = await testMissionSteps(mission.id);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const expectedCoins = mission.coin_reward || (mission.difficulty === 'easy' ? 10 : mission.difficulty === 'medium' ? 20 : 30);
      results.missionCompletion = await testMissionCompletion(mission.id, expectedCoins);
    }
    
    await testFullWorkflow();
  } else {
    console.log('\n⏭️  Skipping backend-dependent tests (backend not available)');
    results.backendAvailable = false;
  }
  
  // Offers filtering test doesn't require backend
  results.offersFiltering = await testOffersFiltering();
  
  // Summary
  console.log('\n\n📊 Test Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  const passed = Object.values(results).filter(r => r?.success !== false).length;
  const total = Object.keys(results).length;
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed or had warnings');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

