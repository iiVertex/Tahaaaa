import React, { useEffect, useState } from 'react';
import { getMissions, startMission, completeMission } from '@/lib/api';

export default function Missions() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMissions()
      .then((list) => setMissions(list || []))
      .catch((e) => setError(e?.message || 'Failed to load missions'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Missions</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <ul style={{ display: 'grid', gap: 12, padding: 0 }}>
        {missions.map((m) => (
          <li key={m.id} className="qic-card" style={{ listStyle: 'none', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <b>{m.title_en || m.title || m.id}</b>
                <div style={{ opacity: 0.8 }}>{m.description_en || m.description}</div>
                <div style={{ opacity: 0.7 }}>XP: {m.xp_reward ?? m.xp_reward_min ?? 10}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => startMission(m.id).then(() => alert('Started'))}>Start</button>
                <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={() => completeMission(m.id).then(() => alert('Completed'))}>Complete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


