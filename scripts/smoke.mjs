import axios from 'axios';

const BASE = process.env.BACKEND_URL || 'http://localhost:3001/api';
const sessionId = `smoke-${Math.random().toString(36).slice(2)}`;
const client = axios.create({ baseURL: BASE, headers: { 'x-session-id': sessionId } });

function log(title, data) {
  const safe = typeof data === 'string' ? data : JSON.stringify(data);
  console.log(`\n=== ${title} ===\n${safe}`);
}

async function main() {
  try {
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
    console.log(`\nSmoke tests completed with session ${sessionId}`);
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('SMOKE ERROR', status, data || error.message);
    process.exitCode = 1;
  }
}

main();


