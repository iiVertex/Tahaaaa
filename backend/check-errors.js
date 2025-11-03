#!/usr/bin/env node

/**
 * Quick error checker for backend startup issues
 */

console.log('\n🔍 Checking for common startup errors...\n');

const errors = [];

// Check 1: Import syntax
console.log('1️⃣  Checking import syntax...');
try {
  await import('./routes/ai.js');
  console.log('   ✅ routes/ai.js imports OK');
} catch (error) {
  errors.push(`routes/ai.js: ${error.message}`);
  console.log(`   ❌ routes/ai.js: ${error.message}`);
}

try {
  await import('./services/profile.service.js');
  console.log('   ✅ services/profile.service.js imports OK');
} catch (error) {
  errors.push(`profile.service.js: ${error.message}`);
  console.log(`   ❌ profile.service.js: ${error.message}`);
}

// Check 2: Missing dependencies
console.log('\n2️⃣  Checking critical dependencies...');
const requiredModules = ['express', 'dotenv', 'fs', 'path', 'url'];
for (const module of requiredModules) {
  try {
    await import(module);
    console.log(`   ✅ ${module} available`);
  } catch (error) {
    errors.push(`Missing dependency: ${module}`);
    console.log(`   ❌ ${module} not available: ${error.message}`);
  }
}

// Check 3: Environment variables
console.log('\n3️⃣  Checking environment setup...');
const { config } = await import('dotenv');
config();

const requiredEnvVars = ['PORT'];
const optionalEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY'];

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`   ✅ ${envVar} set`);
  } else {
    console.log(`   ⚠️  ${envVar} not set (using default)`);
  }
}

for (const envVar of optionalEnvVars) {
  if (process.env[envVar]) {
    console.log(`   ✅ ${envVar} set`);
  } else {
    console.log(`   ⚠️  ${envVar} not set (optional)`);
  }
}

// Check 4: File paths
console.log('\n4️⃣  Checking file paths...');
const fs = await import('fs');
const path = await import('path');

const criticalFiles = [
  'routes/ai.js',
  'services/profile.service.js',
  'server.js',
  'di/container.js'
];

for (const file of criticalFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file} exists`);
  } else {
    errors.push(`Missing file: ${file}`);
    console.log(`   ❌ ${file} not found`);
  }
}

// Summary
console.log('\n📋 Summary:');
if (errors.length === 0) {
  console.log('✅ No errors found! Backend should start successfully.\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${errors.length} error(s):\n`);
  errors.forEach((error, idx) => {
    console.log(`   ${idx + 1}. ${error}`);
  });
  console.log();
  process.exit(1);
}

