import React, { useEffect, useState } from 'react';
import { getRewards, redeemReward } from '@/lib/api';

export default function Rewards() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRewards()
      .then((list) => setRewards(list || []))
      .catch((e) => setError(e?.message || 'Failed to load rewards'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Rewards</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <ul style={{ display: 'grid', gap: 12, padding: 0 }}>
        {rewards.map((r) => (
          <li key={r.id} className="qic-card" style={{ listStyle: 'none', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <b>{r.title_en || r.title || r.id}</b>
                <div style={{ opacity: 0.8 }}>{r.description_en || r.description}</div>
                <div style={{ opacity: 0.7 }}>Cost: {r.coins_cost ?? 0} coins</div>
              </div>
              <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={() => redeemReward(r.id).then(() => alert('Redeemed'))}>Redeem</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


