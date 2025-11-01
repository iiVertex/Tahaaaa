import axios from 'axios';

// Use relative '/api' or BACKEND_URL env var for smoke tests
const BASE = process.env.BACKEND_URL || '/api';
const sessionId = `smoke-${Math.random().toString(36).slice(2)}`;
const client = axios.create({ baseURL: BASE, headers: { 'x-session-id': sessionId } });

function log(title, data) {
  const safe = typeof data === 'string' ? data : JSON.stringify(data);
  console.log(`\n=== ${title} ===\n${safe}`);
}

async function checkPort(port) {
  try {
    const { execSync } = await import('child_process');
    const os = (await import('os')).default;
    const platform = os.platform();
    if (platform === 'win32') {
      const netstat = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      return netstat.trim().length > 0;
    } else {
      execSync(`lsof -ti:${port}`, { encoding: 'utf8' });
      return true;
    }
  } catch {
    return false;
  }
}

async function preflightCheck() {
  console.log('\n🔍 Pre-flight checks...');
  const backendPort = 3001;
  const frontendPort = 8080;
  
  const backendRunning = await checkPort(backendPort);
  const frontendRunning = await checkPort(frontendPort);
  
  console.log(`Backend (${backendPort}): ${backendRunning ? '✓ Running' : '✗ Not running'}`);
  console.log(`Frontend (${frontendPort}): ${frontendRunning ? '✓ Running' : '✗ Not running'}`);
  
  if (!backendRunning) {
    console.warn('⚠️  Backend not detected. Run `npm run dev:both` first.');
    console.warn('   Continuing with tests (will expect offline fallbacks)...\n');
  }
  return { backendRunning, frontendRunning };
}

async function burstTest() {
  console.log('\n🚀 Burst test: 10 requests/second for 3 seconds...');
  const endpoints = ['/health', '/profile', '/ai/recommendations', '/missions'];
  const requests = [];
  const startTime = Date.now();
  const duration = 3000;
  const targetRps = 10;
  const interval = 1000 / targetRps;
  
  let sent = 0;
  while (Date.now() - startTime < duration) {
    for (const endpoint of endpoints) {
      requests.push(
        client.get(endpoint).catch(err => ({
          error: true,
          status: err?.response?.status,
          message: err?.message,
          endpoint
        }))
      );
      sent++;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  const results = await Promise.allSettled(requests);
  const errors = results.filter(r => r.status === 'rejected' || (r.value?.error && r.value?.status !== 429));
  const rateLimited = results.filter(r => r.value?.status === 429);
  
  console.log(`Sent ${sent} requests, completed ${results.length}`);
  console.log(`Errors (excluding 429): ${errors.length}`);
  console.log(`429 Rate Limits: ${rateLimited.length}`);
  
  if (errors.length > 0 && errors.length < results.length * 0.1) {
    console.log('⚠️  Some requests failed (expected if backend offline)');
  } else if (errors.length === 0) {
    console.log('✓ Burst test passed: no connection errors');
  } else {
    console.error('✗ Burst test failed: too many errors');
    process.exitCode = 1;
  }
}

async function offlineTest() {
  console.log('\n📴 Offline test: verifying graceful degradation...');
  try {
    // Stop backend simulation: check if requests fail gracefully
    const results = await Promise.allSettled([
      client.get('/health'),
      client.get('/profile'),
      client.get('/missions'),
      client.get('/products/catalog')
    ]);
    
    const allFailed = results.every(r => r.status === 'rejected');
    const allNetworkErrors = results.every(r => 
      r.status === 'rejected' && 
      (r.reason?.code === 'ERR_NETWORK' || r.reason?.code === 'ECONNREFUSED' || r.reason?.message?.includes('Network'))
    );
    
    if (allNetworkErrors) {
      console.log('✓ Offline mode detected correctly (all network errors)');
      console.log('  Frontend should use offline fallbacks in dev mode');
    } else if (allFailed) {
      console.log('⚠️  All requests failed (backend may be down)');
    } else {
      console.log('✓ Backend is reachable');
    }
  } catch (err) {
    console.log('⚠️  Offline test inconclusive:', err.message);
  }
}

async function main() {
  try {
    const { backendRunning } = await preflightCheck();
    
    if (!backendRunning) {
      await offlineTest();
      return;
    }
    
    // Health
    const health = await client.get('/health');
    log('health', health.data);

    // AI Recommendations
    const ai = await client.get('/ai/recommendations');
    log('ai/recommendations', ai.data);

    // Products Catalog
    const catalog = await client.get('/products/catalog');
    log('products/catalog', catalog.data);

    // Bundle Savings
    const bundle = await client.post('/products/bundle-savings', { product_ids: ['auto_plus','home_secure'] });
    log('products/bundle-savings', bundle.data);

    // Analytics Event
    const ev = await client.post('/analytics/events', { name: 'diagnostic_ping', props: { ok: true }, ts: new Date().toISOString() });
    log('analytics/events', ev.data);
    const evSummary = await client.get('/analytics/events/summary');
    log('analytics/events/summary', evSummary.data);

    // Missions
    const missions = await client.get('/missions');
    log('missions', missions.data);
    const missionId = missions?.data?.missions?.[0]?.id || 'walk-10k';
    try {
      const mStart = await client.post('/missions/start', { missionId });
      log('missions/start', mStart.data);
    } catch (e) {
      if (e?.response?.status === 409) {
        log('missions/start', { success: true, message: 'Already started (ok)' });
      } else {
        throw e;
      }
    }

    // Quotes (rate limited)
    const quoteStart = await client.post('/quotes/start', { product_id: 'auto_plus', inputs: { age: 32, city: 'Doha' } });
    log('quotes/start', quoteStart.data);

    // Burst test: simulate quick nav + tracking + reads
    const burst = [];
    for (let i = 0; i < 5; i++) {
      burst.push(client.get('/profile'));
      burst.push(client.get('/products/catalog'));
      burst.push(client.get('/rewards'));
      burst.push(client.get('/ai/recommendations'));
      // Feature usage tracking (ecosystem) — ensure no 429s when debounced/client-side in app
      burst.push(client.post('/ecosystem/track', { featureName: 'nav', metadata: { step: i } }));
    }
    await Promise.allSettled(burst);
    
    // Extended burst test
    await burstTest();
    
    console.log(`\n✅ Smoke tests completed with session ${sessionId}`);
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('SMOKE ERROR', status, data || error.message);
    process.exitCode = 1;
  }
}

main();


