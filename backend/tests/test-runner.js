#!/usr/bin/env node

/**
 * Feature Test Runner
 * Runs all feature tests and reports results
 */

import { testAISimulate } from './ai-simulate.test.js';
import { testMissionExpansion } from './mission-expansion.test.js';
import { testProfilePersistence } from './profile-persistence.test.js';
import { testCSVDownload } from './csv-download.test.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-' + Date.now();

async function runTests() {
  console.log('\n🧪 Starting Feature Tests...\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Test User ID: ${TEST_USER_ID}\n`);

  const { testAISimulate, testMissionExpansion, testProfilePersistence, testCSVDownload } = await importTests();

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test 1: AI Simulate
  console.log('📊 Testing AI Simulate Feature...');
  try {
    await testAISimulate(API_BASE, TEST_USER_ID);
    results.passed++;
    console.log('✅ AI Simulate tests passed\n');
  } catch (error) {
    results.failed++;
    results.errors.push({ test: 'AI Simulate', error: error.message });
    console.log(`❌ AI Simulate tests failed: ${error.message}\n`);
  }

  // Test 2: Mission Expansion
  console.log('🎯 Testing Mission Expansion Feature...');
  try {
    await testMissionExpansion(API_BASE, TEST_USER_ID);
    results.passed++;
    console.log('✅ Mission Expansion tests passed\n');
  } catch (error) {
    results.failed++;
    results.errors.push({ test: 'Mission Expansion', error: error.message });
    console.log(`❌ Mission Expansion tests failed: ${error.message}\n`);
  }

  // Test 3: Profile Persistence
  console.log('👤 Testing Profile Persistence...');
  try {
    await testProfilePersistence(API_BASE, TEST_USER_ID);
    results.passed++;
    console.log('✅ Profile Persistence tests passed\n');
  } catch (error) {
    results.failed++;
    results.errors.push({ test: 'Profile Persistence', error: error.message });
    console.log(`❌ Profile Persistence tests failed: ${error.message}\n`);
  }

  // Test 4: CSV Download
  console.log('📥 Testing CSV Download Feature...');
  try {
    await testCSVDownload(API_BASE, TEST_USER_ID);
    results.passed++;
    console.log('✅ CSV Download tests passed\n');
  } catch (error) {
    results.failed++;
    results.errors.push({ test: 'CSV Download', error: error.message });
    console.log(`❌ CSV Download tests failed: ${error.message}\n`);
  }

  // Summary
  console.log('\n📋 Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.test}: ${err.error}`);
    });
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});

