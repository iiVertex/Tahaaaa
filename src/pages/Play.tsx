import React, { useEffect, useState } from 'react';
import { getMissions, startMission, completeMission, simulateScenario } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import ScenarioForm from '@/components/ScenarioForm';
import BottomNav from '@/components/BottomNav';
import { CardSkeleton } from '@/components/Skeletons';

export default function Play() {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<any>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    getMissions()
      .then((list) => setMissions(list || []))
      .catch((e) => setError(e?.message || 'Failed to load missions'))
      .finally(() => setLoading(false));
  }, []);

  const runScenario = async (values: any) => {
    setSimLoading(true);
    try {
      const res = await simulateScenario(values);
      setScenario(res?.data || res);
    } catch (e: any) {
      setScenario({ error: e?.message || 'Failed to simulate' });
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: 64, display: 'grid', gap: 16 }}>
      <h2>Play</h2>
      <section>
        <h3>Missions</h3>
        {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
        {error && <p style={{ color: 'salmon' }}>{error}</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          {missions.map((m) => (
            <MissionCard key={m.id} mission={m} onStart={(id)=>startMission(id).then(()=>{})} onComplete={(id)=>completeMission(id).then(()=>{})} />
          ))}
        </div>
      </section>
      <section>
        <h3>Scenario Simulator</h3>
        <ScenarioForm onSubmit={runScenario} loading={simLoading} />
        {scenario && (
          <pre style={{ background: '#111418', padding: 12, borderRadius: 8, marginTop: 12 }}>
            {JSON.stringify(scenario, null, 2)}
          </pre>
        )}
      </section>
      <BottomNav />
    </div>
  );
}


