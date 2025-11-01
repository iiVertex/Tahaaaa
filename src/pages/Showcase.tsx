import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { simulateScenario, getProfile, startMission, completeMission, getRecommendationsContext } from '../lib/api';
import ScenarioForm from '@/components/ScenarioForm';
import MajlisLayout from '@/components/MajlisLayout';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCoins } from '@/lib/coins';
import { insurancePlans, matchPlansByScenario, rerankByProfile, getTipsForPlanType, getDiscounts } from '@/data/insurancePlans';
import { track } from '@/lib/analytics';
import { useToast } from '@/components/Toast';

export default function Showcase() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { coins, addCoins, refreshCoins } = useCoins();
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const prefs = (profile as any)?.userProfile?.profile_json?.preferences || null;
  const { data: recommendations } = useQuery({
    queryKey: ['ai','recommendations', prefs],
    queryFn: () => getRecommendationsContext({ preferences: prefs })
  });
  // Social leaderboard removed in this phase to eliminate 401s and unnecessary calls.

  const profileCtx = React.useMemo(() => ({
    nationality: (profile as any)?.userProfile?.profile_json?.nationality || null,
    budgetQr: (profile as any)?.userProfile?.profile_json?.budget || null,
    preferences: prefs,
    firstTimeBuyer: !!(profile as any)?.userProfile?.profile_json?.first_time_buyer
  }), [profile, prefs]);

  const [scenarioText, setScenarioText] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>('');
  const [planResults, setPlanResults] = React.useState<any[]>([]);
  const [planDiscounts, setPlanDiscounts] = React.useState<any[]>([]);

  async function onSimulate(values: any) {
    setLoading(true); setError(null);
    try {
      const response = await simulateScenario(values);
      const prediction = response?.data || response;
      setResult(prediction);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await refreshCoins(); // Refresh coins from backend (showcase simulation doesn't give coins directly)
      setMessage(t('showcase.simulationComplete'));
    } catch (err: any) {
      // Offline fallback: use local insurance plans matching
      const isNetworkError = !err?.response && (
        err?.code === 'ERR_NETWORK' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message?.includes('Network Error') ||
        err?.message?.includes('Failed to fetch')
      );
      if (import.meta.env.DEV && isNetworkError) {
        const hint = (category || '').toLowerCase();
        const matched = matchPlansByScenario(scenarioText, ['car','motorcycle','travel','home','boat','medical'].includes(hint as any) ? (hint as any) : undefined);
        const ranked = rerankByProfile(matched, profileCtx);
        setPlanResults(ranked.slice(0, 5));
        setPlanDiscounts(getDiscounts(profileCtx));
        await refreshCoins(); // Refresh coins from backend
        toast?.success?.('Simulation complete (offline mode)', t('showcase.simulationComplete'));
        setMessage(t('showcase.simulationComplete') + ' (offline simulated)');
      } else {
        setError(t('errors.simulateScenario', { message: err?.message || '' }));
      }
    } finally { setLoading(false); }
  }

  async function onPlanScenarioSubmit() {
    setError(null); setMessage(null);
    const hint = (category || '').toLowerCase();
    const matched = matchPlansByScenario(scenarioText, ['car','motorcycle','travel','home','boat','medical'].includes(hint as any) ? (hint as any) : undefined);
    const ranked = rerankByProfile(matched, profileCtx);
    const discounts = getDiscounts(profileCtx);
    setPlanResults(ranked.slice(0, 5));
    setPlanDiscounts(discounts);
    await refreshCoins(); // Refresh coins from backend (coins come from backend actions, not frontend)
    try { toast?.success?.(t('showcase.simulationComplete')); } catch {}
    try { track('scenario_submit', { category: hint || 'auto', text_len: scenarioText.length }); } catch {}
    setMessage(t('showcase.simulationComplete'));
  }

  async function onStartMission(id: string) {
    setLoading(true); setError(null);
    try {
      await startMission(id);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['missions'] });
      await refreshCoins(); // Refresh coins from backend
      toast?.success?.(t('showcase.missionStarted') || 'Mission started!', t('showcase.checkMissionsTab') || 'Check Missions tab');
      setMessage(t('showcase.missionStarted'));
      // Redirect to Missions tab with mission ID in URL to auto-expand steps
      setTimeout(() => {
        navigate(`/missions?started=${id}`);
      }, 1000);
    } catch (err: any) { 
      const errorMsg = err?.message || '';
      if (errorMsg.includes('already started') || errorMsg.includes('active')) {
        setError(t('errors.missionAlreadyActive') || 'You already have an active mission. Complete it first or check the Missions tab.');
        toast?.error?.(t('errors.missionAlreadyActive') || 'You already have an active mission');
      } else {
        setError(t('errors.startMission', { message: errorMsg }));
      }
    }
    finally { setLoading(false); }
  }

  async function onCompleteMission(id: string) {
    setLoading(true); setError(null);
    try {
      await completeMission(id);
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await refreshCoins(); // Refresh coins from backend (mission completion awards coins via backend)
      setMessage(t('showcase.missionCompleted'));
    } catch (err: any) { setError(t('errors.completeMission', { message: err?.message || '' })); }
    finally { setLoading(false); }
  }

  return (
    <MajlisLayout titleKey="showcase.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}> 
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      {message && <div style={{ color: 'seagreen' }}>{message}</div>}
      <div className="qic-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>{t('scenarios.title')}</div>
        <label>
          {t('showcase.category') || 'Category'}
          <select value={category} onChange={(e)=> setCategory(e.target.value)}>
            <option value="">Auto</option>
            <option value="car">Car</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="travel">Travel</option>
            <option value="home">Home</option>
            <option value="boat">Boat</option>
            <option value="medical">Medical</option>
          </select>
        </label>
        <label>
          {t('showcase.describePlan') || 'Describe your scenario or plan'}
          <textarea rows={4} placeholder={t('showcase.placeholder') || 'e.g., Planning a Schengen trip in May; need visa-compliant cover and baggage protection.'} value={scenarioText} onChange={(e)=> setScenarioText(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onPlanScenarioSubmit} disabled={loading || !scenarioText.trim()}>{loading ? t('scenarios.simulating') : (t('simulate') || 'Simulate')}</button>
          <button onClick={()=>{ setScenarioText('Family road trip to Salwa in June; new SUV within 3 years, want agency repairs and GCC cover.'); setCategory('car'); }}>{t('showcase.suggest1') || 'Road trip (car)'}</button>
          <button onClick={()=>{ setScenarioText('Two-week Europe vacation in December; Schengen visa, skiing planned.'); setCategory('travel'); }}>{t('showcase.suggest2') || 'Schengen winter (travel)'}</button>
          <button onClick={()=>{ setScenarioText('Renting a new apartment; need contents and theft coverage.'); setCategory('home'); }}>{t('showcase.suggest3') || 'New apartment (home)'}</button>
        </div>
      </div>

      {(result || planResults.length > 0) && (
        <div className="qic-card" style={{ padding: 16 }}>
          <h3>{t('showcase.prediction')}</h3>
          {result && (
            <>
              {result.narrative && <p>{result.narrative}</p>}
              {result.severity_score !== undefined && (
                <div style={{ marginTop: 8, padding: 8, background: 'var(--qic-surface)', borderRadius: 6 }}>
                  <strong>Scenario Severity: {result.severity_score}/10</strong>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {result.severity_score >= 8 ? 'High urgency - immediate action recommended' :
                     result.severity_score >= 5 ? 'Medium urgency - plan ahead' :
                     'Low urgency - consider for future planning'}
                  </div>
                </div>
              )}
              {result.risk_level && <p>{t('showcase.risk', { level: result.risk_level })}</p>}
              {(result.lifescore_impact !== undefined || result.xp_reward !== undefined) && (
                <p>{t('showcase.preview', { lifescore: result.lifescore_impact || 0, xp: result.xp_reward || 0 })}</p>
              )}
              {result.recommended_plans && result.recommended_plans.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4>{t('showcase.recommendedPlans') || 'Recommended Plans (Sorted by Relevance)'}</h4>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {result.recommended_plans.map((p: any, idx: number) => (
                      <div key={idx} className="qic-card" style={{ padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <div><b>{p.plan_name}</b> · {p.plan_type}</div>
                            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{p.description}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--qic-accent)' }}>
                              {p.relevance_score}/10
                            </div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>Relevance</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, padding: 8, background: 'var(--qic-surface)', borderRadius: 4, fontSize: 12 }}>
                          <strong>Qatar Compliance:</strong> {p.qatar_compliance || 'Standard QIC coverage'}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <strong>Estimated Premium:</strong> {p.estimated_premium || 'Contact for quote'}
                        </div>
                        {p.key_features && p.key_features.length > 0 && (
                          <ul style={{ paddingLeft: 16, marginTop: 8, fontSize: 12 }}>
                            {p.key_features.map((f: string, i: number) => (<li key={i}>{f}</li>))}
                          </ul>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <button onClick={()=>{ try { track('plan_view', { type: p.plan_type, name: p.plan_name }); } catch {} }}>
                            {t('showcase.explore') || 'Explore'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {planResults.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <h4>{t('showcase.recommendedPlans') || 'Recommended Plans'}</h4>
              {planResults.map((p:any, idx:number) => (
                <div key={idx} className="qic-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div><b>{p.fullName}</b> · {p.type}</div>
                      <div style={{ opacity: 0.8 }}>{p.conciseDescription}</div>
                    </div>
                    <div>
                      <button onClick={()=>{ try { track('plan_view', { type: p.type, name: p.fullName }); } catch {} }}>{t('showcase.explore') || 'Explore'}</button>
                    </div>
                  </div>
                  <ul style={{ paddingLeft: 16, marginTop: 8 }}>
                    {p.keyFeatures.slice(0,3).map((f:string, i:number)=>(<li key={i}>{f}</li>))}
                  </ul>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {getTipsForPlanType(p.type).map((tip, i)=>(
                      <span key={i} className="qic-card" style={{ padding: '4px 8px', fontSize: 12 }}>{tip.title}: {tip.detail}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {planDiscounts.map((d:any, i:number)=>(
                      <button key={i} className="qic-card" style={{ padding: '2px 6px', fontSize: 11, background: 'var(--qic-accent)' }} title={d.rationale}
                        onClick={()=>{ try { track('discount_click', { kind: d.kind, label: d.label }); } catch {};
                          if (d.kind === 'first_time') window.location.href = '/rewards';
                          if (d.kind === 'nationality') window.open('https://www.gco.gov.qa/en/','_blank');
                        }}
                      >{d.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <h4>{t('missions.suggested')}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {(result?.suggested_missions || []).map((m: any) => (
                  <div key={m.id} className="qic-card" style={{ padding: 12, position: 'relative' }}>
                    {Array.isArray((profile as any)?.userProfile?.profile_json?.preferences?.interests) && (profile as any).userProfile.profile_json.preferences.interests.includes((m.category||'').toLowerCase()) && (
                      <div aria-label="AI Pick" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--qic-secondary)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 6 }}>{t('ai.pickLabel')}</div>
                    )}
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

      {/* Coins status (UI-only) */}
        <div className="qic-card" style={{ padding: 16 }}>
        <h3>{t('showcase.status')}</h3>
        <div>Coins: <b>{coins}</b></div>
        <div>{t('stats.xp')}: <b>{profile?.stats?.xp ?? profile?.user?.xp ?? 0}</b></div>
        <div>{t('stats.level')}: <b>{profile?.stats?.level ?? profile?.user?.level ?? 1}</b></div>
        </div>

    </MajlisLayout>
  );
}


