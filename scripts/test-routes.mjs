import axios from 'axios';
import { setTimeout } from 'timers/promises';

const BASE = process.env.BACKEND_URL || 'http://localhost:3001/api';
const FRONTEND = 'http://localhost:8080';
const sessionId = `test-${Date.now()}`;
const client = axios.create({ 
  baseURL: BASE, 
  headers: { 'x-session-id': sessionId },
  timeout: 5000
});

const errors = [];
const successes = [];

function log(message, type = 'info') {
  const prefix = type === 'error' ? '✗' : type === 'success' ? '✓' : '→';
  console.log(`${prefix} ${message}`);
}

async function testEndpoint(name, method = 'GET', data = null) {
  try {
    const url = name.startsWith('/') ? name : `/${name}`;
    const response = method === 'GET' 
      ? await client.get(url)
      : await client.post(url, data);
    successes.push(name);
    log(`${name} - Status: ${response.status}`, 'success');
    return { success: true, data: response.data };
  } catch (error) {
    const status = error?.response?.status;
    const code = error?.code;
    const message = error?.message;
    errors.push({ name, status, code, message });
    
    if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED') {
      log(`${name} - Network error (backend may be down)`, 'error');
    } else if (status) {
      log(`${name} - HTTP ${status}: ${message}`, 'error');
    } else {
      log(`${name} - Error: ${message}`, 'error');
    }
    return { success: false, error: { status, code, message } };
  }
}

async function testFrontendRoutes() {
  console.log('\n🌐 Testing Frontend Routes...\n');
  
  const routes = [
    '/',
    '/play',
    '/missions',
    '/rewards',
    '/achievements',
    '/scenarios',
    '/profile',
    '/showcase'
  ];
  
  const frontendClient = axios.create({ 
    baseURL: FRONTEND,
    timeout: 3000,
    validateStatus: () => true // Accept any status
  });
  
  for (const route of routes) {
    try {
      const response = await frontendClient.get(route);
      if (response.status >= 200 && response.status < 400) {
        successes.push(`Frontend${route}`);
        log(`Frontend ${route} - Status: ${response.status}`, 'success');
      } else {
        errors.push({ name: `Frontend${route}`, status: response.status });
        log(`Frontend ${route} - Status: ${response.status}`, 'error');
      }
    } catch (error) {
      errors.push({ name: `Frontend${route}`, error: error.message });
      log(`Frontend ${route} - ${error.message}`, 'error');
    }
    await setTimeout(200); // Small delay between requests
  }
}

async function testBackendEndpoints() {
  console.log('\n🔌 Testing Backend API Endpoints...\n');
  
  // Health check first
  await testEndpoint('/health');
  await setTimeout(500);
  
  // Core read endpoints
  await testEndpoint('/profile');
  await testEndpoint('/missions');
  await testEndpoint('/products/catalog');
  await testEndpoint('/rewards');
  await testEndpoint('/achievements');
  await testEndpoint('/achievements/user');
  await testEndpoint('/ai/recommendations');
  await setTimeout(500);
  
  // Write endpoints (with sample data)
  await testEndpoint('/ecosystem/track', 'POST', { 
    featureName: 'test_route_validation', 
    metadata: { test: true } 
  });
  
  await testEndpoint('/analytics/events', 'POST', {
    name: 'test_event',
    props: { source: 'route_test' },
    ts: new Date().toISOString()
  });
  
  await testEndpoint('/products/bundle-savings', 'POST', {
    product_ids: ['auto_plus', 'home_secure']
  });
  
  // Missions with sample missionId
  try {
    const missionsRes = await testEndpoint('/missions');
    if (missionsRes.success && missionsRes.data?.missions?.length > 0) {
      const missionId = missionsRes.data.missions[0].id;
      await testEndpoint('/missions/start', 'POST', { missionId });
    }
  } catch (e) {
    log('Skipping mission start (no missions available)', 'info');
  }
}

async function checkPort(port) {
  try {
    const { execSync } = await import('child_process');
    const os = (await import('os')).default;
    const platform = os.platform();
    if (platform === 'win32') {
      try {
        execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        return true;
      } catch {
        return false;
      }
    } else {
      try {
        execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n🧪 Comprehensive Route Testing\n');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Backend URL: ${BASE}`);
  console.log(`Frontend URL: ${FRONTEND}\n`);
  
  // Check if servers are running
  const backendRunning = await checkPort(3001);
  const frontendRunning = await checkPort(8080);
  
  console.log(`Backend (3001): ${backendRunning ? '✓ Running' : '✗ Not running'}`);
  console.log(`Frontend (8080): ${frontendRunning ? '✓ Running' : '✗ Not running'}\n`);
  
  if (!frontendRunning) {
    console.log('⚠️  Frontend not running. Starting tests anyway...\n');
  }
  
  // Test frontend routes
  await testFrontendRoutes();
  
  // Test backend endpoints
  if (backendRunning) {
    await testBackendEndpoints();
  } else {
    console.log('\n⚠️  Backend not running. Skipping API endpoint tests.');
    console.log('   Start backend with: npm --prefix backend run dev\n');
  }
  
  // Summary
  console.log('\n📊 Test Summary\n');
  console.log(`✓ Successes: ${successes.length}`);
  console.log(`✗ Errors: ${errors.length}\n`);
  
  if (errors.length > 0) {
    console.log('Errors Details:');
    errors.forEach(err => {
      console.log(`  - ${err.name}: ${err.status || err.code || err.message || err.error}`);
    });
    console.log();
  }
  
  if (errors.length === 0 && backendRunning && frontendRunning) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else if (errors.length > 0) {
    console.log('⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  } else {
    console.log('⚠️  Tests completed with warnings.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

