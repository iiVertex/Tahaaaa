import React from 'react';
import { useTranslation } from 'react-i18next';
import { simulateScenario, getProfile, startMission, completeMission, getRecommendations } from '../lib/api';
import ScenarioForm from '@/components/ScenarioForm';
import MajlisLayout from '@/components/MajlisLayout';
import { DatePalmIcon } from '@/components/QatarAssets';

export default function Showcase() {
  const { t } = useTranslation();
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

  async function onSimulate(values: any) {
    setLoading(true); setError(null);
    try {
      const response = await simulateScenario(values);
      const prediction = response?.data || response;
      setResult(prediction);
      const updated = await getProfile();
      setProfile(updated);
      setMessage(t('showcase.simulationComplete'));
    } catch (err: any) {
      setError(t('errors.simulateScenario', { message: err?.message || '' }));
    } finally { setLoading(false); }
  }

  async function onStartMission(id: string) {
    setLoading(true); setError(null);
    try {
      await startMission(id);
      const updated = await getProfile();
      setProfile(updated);
      setMessage(t('showcase.missionStarted'));
    } catch (err: any) { setError(t('errors.startMission', { message: err?.message || '' })); }
    finally { setLoading(false); }
  }

  async function onCompleteMission(id: string) {
    setLoading(true); setError(null);
    try {
      await completeMission(id);
      const updated = await getProfile();
      setProfile(updated);
      setMessage(t('showcase.missionCompleted'));
    } catch (err: any) { setError(t('errors.completeMission', { message: err?.message || '' })); }
    finally { setLoading(false); }
  }

  return (
    <MajlisLayout titleKey="showcase.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {message && <div style={{ color: 'seagreen' }}>{message}</div>}
      <ScenarioForm onSubmit={onSimulate} loading={loading} />

      {result && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('showcase.prediction')}</h3>
          <p>{result.narrative}</p>
          <p>{t('showcase.risk', { level: result.risk_level })}</p>
          <p>{t('showcase.preview', { lifescore: result.lifescore_impact, xp: result.xp_reward })}</p>
          <h4>{t('missions.suggested')}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {result.suggested_missions?.map((m: any) => (
              <div key={m.id} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                    <div>{t('showcase.rewardSummary', { xp: m.xp_reward, lifescore: m.lifescore_impact })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStartMission(m.id)} disabled={loading}>{t('start')}</button>
                    <button onClick={() => onCompleteMission(m.id)} disabled={loading}>{t('complete')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('ai.insights')}</h3>
          <ul style={{ paddingLeft: 16 }}>
            {recommendations.insights?.map((i: any, idx: number) => (
              <li key={idx}>
                <b>{i.title}</b>: {i.detail}
                <span style={{ opacity: 0.7 }}> {t('showcase.confidence', { percent: Math.round((i.confidence || 0) * 100) })}</span>
              </li>
            ))}
          </ul>
          <h4>{t('showcase.adaptive')}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {recommendations.suggested_missions?.map((m: any) => (
              <div key={m.id} className="qic-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><b>{m.title}</b> · {m.category} · {m.difficulty}</div>
                    <div>{t('showcase.rewardSummary', { xp: m.xp_reward, lifescore: m.lifescore_impact })}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStartMission(m.id)} disabled={loading}>{t('start')}</button>
                    <button onClick={() => onCompleteMission(m.id)} disabled={loading}>{t('complete')}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('showcase.status')}</h3>
          <div>{t('stats.lifescore') || 'LifeScore'}: <b>{profile?.stats?.lifescore ?? profile?.user?.lifescore ?? 0}</b></div>
          <div>{t('stats.xp')}: <b>{profile?.stats?.xp ?? profile?.user?.xp ?? 0}</b></div>
          <div>{t('stats.level')}: <b>{profile?.stats?.level ?? profile?.user?.level ?? 1}</b></div>
        </div>
      )}

      {!!leaderboard.length && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('showcase.leaderboard')}</h3>
          <ol style={{ paddingLeft: 16 }}>
            {leaderboard.map((u: any) => (
              <li key={u.id}>
                <b>{u.username || u.id}</b> — {t('showcase.leaderboardEntry', { lifescore: u.lifescore, xp: u.xp })}
              </li>
            ))}
          </ol>
        </div>
      )}
    </MajlisLayout>
  );
}


