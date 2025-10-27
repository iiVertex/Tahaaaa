import React, { useEffect, useState } from 'react';
import { getSkills, unlockSkill } from '@/lib/api';

export default function SkillTree() {
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSkills()
      .then((list) => setSkills(list || []))
      .catch((e) => setError(e?.message || 'Failed to load skills'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Skill Tree</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <ul style={{ display: 'grid', gap: 12, padding: 0 }}>
        {skills.map((s) => (
          <li key={s.id} className="qic-card" style={{ listStyle: 'none', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <b>{s.title_en || s.title || s.id}</b>
                <div style={{ opacity: 0.8 }}>{s.description_en || s.description}</div>
                <div style={{ opacity: 0.7 }}>XP cost: {s.xp_cost ?? 0}</div>
              </div>
              <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={() => unlockSkill(s.id).then(() => alert('Unlocked'))}>Unlock</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}


