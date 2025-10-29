import React, { useEffect, useMemo, useState } from 'react';
import { getMissions, getRecommendations, startMission, completeMission, simulateScenario } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import ScenarioForm from '@/components/ScenarioForm';
import { CardSkeleton } from '@/components/Skeletons';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import PremiumSimulator from '@/components/PremiumSimulator';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Play() {
  const { t } = useTranslation();
  const toast = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<any>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMissions().catch(() => { setError(t('errors.loadMissions')); return []; }),
      getRecommendations().catch(() => ({ suggested_missions: [] }))
    ]).then(([list, rec]: any) => {
      setMissions(list || []);
      setRecommended(rec?.suggested_missions || []);
    }).finally(() => setLoading(false));
  }, [t]);

  const runScenario = async (values: any) => {
    setSimLoading(true);
    try {
      const res = await simulateScenario(values);
      setScenario(res?.data || res);
    } catch (e: any) {
      setScenario({ error: t('errors.simulateScenario', { message: e?.message || '' }) });
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <MajlisLayout titleKey="play.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      <section className="grid-play">
        <div>
          <h3>{t('missions.title')}</h3>
          {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
          {error && <p style={{ color: 'salmon' }}>{error}</p>}
          {recommended.length > 0 && (
            <div className="qic-card" style={{ padding: 12, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('ai.picks')}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {recommended.slice(0,3).map((m:any) => (
                  <div key={`rec-${m.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div>{m.title_en || m.title || m.id}</div>
                      {m.ai_rationale && <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{m.ai_rationale}</div>}
                    </div>
                    <span style={{ fontSize: 12, background: 'var(--qic-accent)', color: '#111', padding: '2px 6px', borderRadius: 6 }}>{t('ai.pickLabel')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            {missions.map((m) => (
              <motion.div key={m.id} variants={cardEntranceVariants} initial="initial" animate="animate">
                <MissionCard
                  mission={m}
                  onStart={(id)=>startMission(id).then(()=>toast.success('Mission started', m.title_en || m.title || id)).catch((e)=>toast.error('Start failed', e?.message))}
                  onComplete={(id)=>completeMission(id).then(()=>toast.success('Mission completed', `+${m.xp_reward ?? 10} XP`)).catch((e)=>toast.error('Complete failed', e?.message))}
                />
              </motion.div>
            ))}
            {(!loading && !error && missions.length === 0) && (
              <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DatePalmIcon size={18} color="var(--qic-secondary)" />
                <div>{t('missions.empty')}</div>
              </div>
            )}
          </div>
        </div>
        <section>
        <h3>{t('scenarios.title')}</h3>
        <ScenarioForm onSubmit={runScenario} loading={simLoading} />
        {scenario && (
          <div className="qic-card" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 8 }}>
            {'error' in scenario ? (
              <div style={{ color: 'salmon' }}>{scenario.error}</div>
            ) : (
              <>
                <div>{scenario.narrative}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('scenarios.lifescoreImpact')}</span>
                  <div style={{ flex: 1, height: 8, background: '#E6E8EE', borderRadius: 6, overflow: 'hidden' }}>
                    <motion.div style={{ height: '100%', background: 'var(--qic-primary)' }} animate={{ width: `${Math.min(100, Math.max(0, (scenario.lifescore_impact+100)/2))}%` }} />
                  </div>
                </div>
                {Array.isArray(scenario.suggested_missions) && scenario.suggested_missions.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('ai.suggestedFromScenario')}</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {scenario.suggested_missions.slice(0,3).map((m:any)=> (
                        <div key={`sim-${m.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>{m.title_en || m.title || m.id}</div>
                          <button onClick={() => startMission(m.id)} style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}>{t('start')}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <h3>{t('premium.simulatorTitle')}</h3>
          <PremiumSimulator />
        </div>
        </section>
      </section>
    </MajlisLayout>
  );
}


