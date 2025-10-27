import React, { useState } from 'react';
import { simulateScenario } from '@/lib/api';

export default function Scenarios() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const run = async () => {
    setLoading(true);
    try {
      const data = await simulateScenario({
        lifestyle_factors: { age: 30, occupation: 'engineer' },
      });
      setResult(data?.data || data);
    } catch (e: any) {
      setResult({ error: e?.message || 'Failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Scenarios</h2>
      <button onClick={run} disabled={loading}>{loading ? 'Simulating...' : 'Simulate'}</button>
      <pre style={{ background: '#111418', padding: 12, borderRadius: 8, marginTop: 12 }}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}


