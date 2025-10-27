import React from 'react';
import { simulateScenario, getProfile, startMission, completeMission, getRecommendations } from '../lib/api';

export default function Showcase() {
  const [inputs, setInputs] = React.useState({ walk_minutes: 30, diet_quality: 'good', commute_distance: 10, seatbelt_usage: 'always' });
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [recommendations, setRecommendations] = React.useState<any>(null);
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);

  React.useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
    getRecommendations().then(setRecommendations).catch(() => {});
    fetch(((import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api') + '/social/leaderboard')
      .then(r => r.json())
      .then(j => setLeaderboard(j?.data?.leaderboard || []))
      .catch(() => {});
  }, []);

  async function onSimulate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { data } = await simulateScenario(inputs);
      setResult(data);
      const updated = await getProfile();
      setProfile(updated);
      setMessage('Simulation complete');
    } catch (err: any) {
      setError(err?.message || 'Failed to simulate');
    } finally { setLoading(false); }
  }

  async function onStartMission(id: string) {
    setLoading(true); setError(null);
    try {
      await startMission(id);
      const updated = await getProfile();
      setProfile(updated);
      setMessage('Mission started');
    } catch (err: any) { setError(err?.message || 'Failed to start mission'); }
    finally { setLoading(false); }
  }

  async function onCompleteMission(id: string) {
    setLoading(true); setError(null);
    try {
      await completeMission(id);
      const updated = await getProfile();
      setProfile(updated);
      setMessage('Mission completed');
    } catch (err: any) { setError(err?.message || 'Failed to complete mission'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2>AI Showcase</h2>
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {message && <div style={{ color: 'seagreen' }}>{message}</div>}
      <form onSubmit={onSimulate} style={{ display: 'grid', gap: 8 }}>
        <label>
          Walk Minutes
          <input type="number" value={inputs.walk_minutes}
                 onChange={e => setInputs({ ...inputs, walk_minutes: Number(e.target.value) })} />
        </label>
        <label>
          Diet Quality
          <select value={inputs.diet_quality} onChange={e => setInputs({ ...inputs, diet_quality: e.target.value })}>
            <option value="excellent">excellent</option>
            <option value="good">good</option>
            <option value="fair">fair</option>
            <option value="poor">poor</option>
          </select>
        </label>
        <label>
          Commute Distance (km)
          <input type="number" value={inputs.commute_distance}
                 onChange={e => setInputs({ ...inputs, commute_distance: Number(e.target.value) })} />
        </label>
        <label>
          Seatbelt Usage
          <select value={inputs.seatbelt_usage} onChange={e => setInputs({ ...inputs, seatbelt_usage: e.target.value })}>
            <option value="always">always</option>
            <option value="often">often</option>
            <option value="rarely">rarely</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>Simulate</button>
      </form>

      {result && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>Prediction</h3>
          <p>{result.narrative}</p>
          <p>Risk: <b>{result.risk_level}</b></p>
          <p>Preview: LifeScore +{result.lifescore_impact}, XP +{result.xp_reward}</p>
          <h4>Suggested Missions</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {result.suggested_missions?.map((m: any) => (
              <div key={m.id} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                    <div>XP +{m.xp_reward}, LifeScore +{m.lifescore_impact}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStartMission(m.id)} disabled={loading}>Start</button>
                    <button onClick={() => onCompleteMission(m.id)} disabled={loading}>Complete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>AI Insights</h3>
          <ul style={{ paddingLeft: 16 }}>
            {recommendations.insights?.map((i: any, idx: number) => (
              <li key={idx}><b>{i.title}</b>: {i.detail} <span style={{ opacity: 0.7 }}>(conf {Math.round((i.confidence||0)*100)}%)</span></li>
            ))}
          </ul>
          <h4>Adaptive Missions</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {recommendations.suggested_missions?.map((m: any) => (
              <div key={m.id} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                    <div>XP +{m.xp_reward}, LifeScore +{m.lifescore_impact}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStartMission(m.id)} disabled={loading}>Start</button>
                    <button onClick={() => onCompleteMission(m.id)} disabled={loading}>Complete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>Your Status</h3>
          <div>LifeScore: <b>{profile?.stats?.lifescore ?? profile?.user?.lifescore ?? 0}</b></div>
          <div>XP: <b>{profile?.stats?.xp ?? profile?.user?.xp ?? 0}</b></div>
          <div>Level: <b>{profile?.stats?.level ?? profile?.user?.level ?? 1}</b></div>
        </div>
      )}

      {!!leaderboard.length && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>Leaderboard</h3>
          <ol style={{ paddingLeft: 16 }}>
            {leaderboard.map((u: any) => (
              <li key={u.id}>
                <b>{u.username || u.id}</b> — LifeScore {u.lifescore}, XP {u.xp}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}


