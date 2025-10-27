import React, { useEffect, useState } from 'react';
import LifeScoreRing from '@/components/LifeScoreRing';
import BottomNav from '@/components/BottomNav';
import { getProfile } from '@/lib/api';

export default function Health() {
  const [status, setStatus] = useState<string>('Checking...');
  const [life, setLife] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then((r) => r.json())
      .then((j) => setStatus(`${j.data?.status || 'OK'} — v${j.data?.version || 'n/a'}`))
      .catch((e) => setStatus(`Error: ${e?.message || e}`));
    getProfile().then(p => {
      const ls = (p as any)?.stats?.lifescore ?? (p as any)?.user?.lifescore ?? 0;
      const xpVal = (p as any)?.stats?.xp ?? (p as any)?.user?.xp ?? 0;
      const lvl = (p as any)?.stats?.level ?? (p as any)?.user?.level ?? 1;
      setLife(ls); setXp(xpVal); setLevel(lvl);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ paddingBottom: 64 }}>
      <h2>Dashboard</h2>
      <p>{status}</p>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <LifeScoreRing value={life} />
        <div>
          <div>XP: <b>{xp}</b></div>
          <div>Level: <b>{level}</b></div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}


