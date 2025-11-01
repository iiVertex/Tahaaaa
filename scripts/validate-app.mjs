import axios from 'axios';

const FRONTEND = 'http://localhost:8080';
const BACKEND = 'http://localhost:3001/api';
const sessionId = `validate-${Date.now()}`;

const client = axios.create({ 
  baseURL: BACKEND, 
  headers: { 'x-session-id': sessionId },
  timeout: 5000
});

const frontendClient = axios.create({ baseURL: FRONTEND, timeout: 3000 });

const errors = [];
const warnings = [];
const successes = [];

function log(message, type = 'info') {
  const prefix = type === 'error' ? '✗' : type === 'warning' ? '⚠' : type === 'success' ? '✓' : '→';
  console.log(`${prefix} ${message}`);
}

async function validateEndpoint(name, validator = null) {
  try {
    const response = await client.get(name.startsWith('/') ? name : `/${name}`);
    if (validator && !validator(response.data)) {
      warnings.push(`${name}: Response validation failed`);
      log(`${name} - Response structure may be unexpected`, 'warning');
    } else {
      successes.push(name);
      log(`${name} - OK`, 'success');
    }
    return { success: true, data: response.data };
  } catch (error) {
    errors.push({ name, error: error.message });
    log(`${name} - ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function validateDataStructure() {
  console.log('\n📋 Validating Data Structures...\n');
  
  // Test missions response structure
  const missions = await validateEndpoint('/missions', (data) => {
    return data?.success && (
      Array.isArray(data?.data?.missions) || 
      Array.isArray(data?.data)
    );
  });
  
  // Test profile response structure
  const profile = await validateEndpoint('/profile', (data) => {
    return data?.success && (
      data?.data?.user || 
      data?.data?.profile || 
      data?.data?.stats
    );
  });
  
  // Test products structure
  const products = await validateEndpoint('/products/catalog', (data) => {
    return data?.success && (
      Array.isArray(data?.data?.products) || 
      Array.isArray(data?.data)
    );
  });
  
  // Test rewards structure
  const rewards = await validateEndpoint('/rewards', (data) => {
    return data?.success && (
      Array.isArray(data?.data?.rewards) || 
      Array.isArray(data?.data)
    );
  });
}

async function validateFrontendRoutes() {
  console.log('\n🌐 Validating Frontend Routes...\n');
  
  const routes = ['/', '/play', '/missions', '/rewards', '/achievements', '/scenarios', '/profile', '/showcase'];
  
  for (const route of routes) {
    try {
      const response = await frontendClient.get(route, { validateStatus: () => true });
      if (response.status >= 200 && response.status < 400) {
        successes.push(`Frontend${route}`);
        log(`Frontend ${route} - ${response.status}`, 'success');
      } else {
        errors.push({ name: `Frontend${route}`, error: `HTTP ${response.status}` });
        log(`Frontend ${route} - HTTP ${response.status}`, 'error');
      }
    } catch (error) {
      errors.push({ name: `Frontend${route}`, error: error.message });
      log(`Frontend ${route} - ${error.message}`, 'error');
    }
  }
}

async function validateBackendConnectivity() {
  console.log('\n🔌 Validating Backend Connectivity...\n');
  
  try {
    const health = await client.get('/health');
    if (health.data?.success && health.data?.data?.status === 'OK') {
      log('Backend health check - OK', 'success');
      successes.push('health');
    } else {
      warnings.push('Health check response unexpected');
      log('Backend health check - Unexpected response', 'warning');
    }
  } catch (error) {
    errors.push({ name: 'health', error: error.message });
    log(`Backend health check - ${error.message}`, 'error');
  }
}

async function validateApiEndpoints() {
  console.log('\n📡 Validating API Endpoints...\n');
  
  await validateEndpoint('/health');
  await validateEndpoint('/profile');
  await validateEndpoint('/missions');
  await validateEndpoint('/products/catalog');
  await validateEndpoint('/rewards');
  await validateEndpoint('/achievements');
  await validateEndpoint('/achievements/user');
}

async function main() {
  console.log('\n🧪 Comprehensive Application Validation\n');
  console.log(`Session: ${sessionId}`);
  console.log(`Backend: ${BACKEND}`);
  console.log(`Frontend: ${FRONTEND}\n`);
  
  await validateBackendConnectivity();
  await validateApiEndpoints();
  await validateDataStructure();
  await validateFrontendRoutes();
  
  console.log('\n📊 Validation Summary\n');
  console.log(`✓ Successes: ${successes.length}`);
  console.log(`⚠ Warnings: ${warnings.length}`);
  console.log(`✗ Errors: ${errors.length}\n`);
  
  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log();
  }
  
  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
    console.log();
    process.exit(1);
  }
  
  if (successes.length > 0 && errors.length === 0) {
    console.log('✅ All validations passed!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

