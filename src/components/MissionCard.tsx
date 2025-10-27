import React from 'react';

type Mission = {
  id: string;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  category?: string;
  difficulty?: string;
  xp_reward?: number;
  lifescore_impact?: number;
};

export default function MissionCard({ mission, onStart, onComplete, loading }:{ mission: Mission; onStart: (id:string)=>void; onComplete: (id:string)=>void; loading?: boolean }) {
  return (
    <div className="qic-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <b>{mission.title_en || mission.title || mission.id}</b>
          <div style={{ opacity: 0.8 }}>{mission.description_en || mission.description}</div>
          <div style={{ opacity: 0.7 }}>XP: {mission.xp_reward ?? 10} {mission.lifescore_impact ? `· LifeScore +${mission.lifescore_impact}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onStart(mission.id)} disabled={loading}>Start</button>
          <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={() => onComplete(mission.id)} disabled={loading}>Complete</button>
        </div>
      </div>
    </div>
  );
}


