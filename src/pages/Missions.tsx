import React, { useEffect, useState } from 'react';
import { getMissions, startMission, completeMission } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import BottomNav from '@/components/BottomNav';
import { CardSkeleton } from '@/components/Skeletons';

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
    <div style={{ paddingBottom: 64 }}>
      <h2>Missions</h2>
      {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} onStart={(id)=>startMission(id).then(()=>{})} onComplete={(id)=>completeMission(id).then(()=>{})} />
        ))}
      </div>
      <BottomNav />
    </div>
  );
}


