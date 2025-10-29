import React, { useEffect, useMemo, useState } from 'react';
import LifeScoreRing from '@/components/LifeScoreRing';
import { health as healthApi, getProfile, getAIInsights, getRecommendations, getProductsCatalog, getBundleSavings, startMission, completeMission } from '@/lib/api';
import ProductOfferCard from '@/components/ProductOfferCard';
import { track } from '@/lib/analytics';
import QuoteDrawer from '@/components/QuoteDrawer';
import InsightCard from '@/components/InsightCard';
import { DallahIcon, DatePalmIcon } from '@/components/QatarAssets';
import usePersonalization from '@/hooks/usePersonalization';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import MissionCard from '@/components/MissionCard';
import { CardSkeleton, InsightSkeleton, MissionSkeleton } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import BundleCalculator from '@/components/BundleCalculator';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Health() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>(t('status.checking'));
  const [life, setLife] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [trend, setTrend] = useState<'up'|'down'|'flat'>('flat');
  const [streak, setStreak] = useState<number>(0);
  const [insights, setInsights] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [bundle, setBundle] = useState<any | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteProductId, setQuoteProductId] = useState<string | undefined>(undefined);
  const { order } = usePersonalization();
  const [loading, setLoading] = useState<boolean>(true);
  const toast = useToast();

  useEffect(() => {
    setStatus(t('status.checking'));
    healthApi().then((j:any)=> setStatus(`${j?.data?.status || j?.status || 'OK'} — v${j?.data?.version || j?.version || 'n/a'}`))
      .catch((e:any) => setStatus(t('status.error', { message: e?.message || e })));
    getProfile().then(p => {
      const ls = (p as any)?.stats?.lifescore ?? (p as any)?.user?.lifescore ?? 0;
      const xpVal = (p as any)?.stats?.xp ?? (p as any)?.user?.xp ?? 0;
      const lvl = (p as any)?.stats?.level ?? (p as any)?.user?.level ?? 1;
      const tr = (p as any)?.stats?.lifescoreTrend || 'flat';
      const st = (p as any)?.stats?.currentStreak ?? (p as any)?.user?.streak_days ?? 0;
      setLife(ls); setXp(xpVal); setLevel(lvl); setTrend(tr); setStreak(st);
    }).catch(() => {});
    Promise.all([
      getAIInsights().catch(()=>[]),
      getRecommendations().catch(()=>({ suggested_missions: [], product_recommendations: [] })),
      getProductsCatalog().catch(()=>[])
    ]).then(([i, r, catalog]: any)=>{
      setInsights(i || []);
      setSuggested(r?.suggested_missions || []);
      const prs = r?.product_recommendations || [];
      setOffers(prs);
      prs.forEach((o:any)=> track('offer_view', { product_id: o.product_id }));
      // compute a simple bundle suggestion using catalog
      const ids = (catalog as any[]).slice(0,2).map(p=>p.id);
      if (ids.length >= 2) {
        getBundleSavings(ids).then((b)=> setBundle({ ids, ...b })).catch(()=> setBundle(null));
      }
    }).finally(() => setLoading(false));
  }, [t]);

  const modules = useMemo(() => ({
    'offers-strip': (
      offers && offers.length > 0 ? (
        <section>
          <h3 style={{ marginBottom: 8 }}>{t('offers.prequalified')}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {offers.slice(0,2).map((o:any)=> (
              <ProductOfferCard key={o.product_id} offer={o} onCta={(offer)=>{ track('offer_click', { product_id: offer.product_id }); setQuoteProductId(offer.product_id); setQuoteOpen(true); }} />
            ))}
          </div>
        </section>
      ) : null
    ),
    'health-summary': (
      <motion.section variants={cardEntranceVariants} initial="initial" animate="animate">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <LifeScoreRing value={life} trend={trend} level={level} />
          <div>
            <div>{t('stats.xp')}: <b>{xp}</b></div>
            <div>{t('stats.level')}: <b>{level}</b></div>
            <div>{t('stats.streak')}: <b>🔥 {streak} {t('stats.days')}</b></div>
          </div>
        </div>
      </motion.section>
    ),
    'ai-insights': (
      <section>
        <h3 style={{ marginBottom: 8 }}>{t('ai.insights')}</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {loading && (<><InsightSkeleton /><InsightSkeleton /></>)}
          {!loading && insights.slice(0,3).map((ins, idx) => (<InsightCard key={idx} insight={ins} />))}
          {!loading && insights.length === 0 && (
            <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DatePalmIcon size={18} color="var(--qic-secondary)" />
              <div>{t('ai.emptyInsights')}</div>
            </div>
          )}
        </div>
      </section>
    ),
    'bundle-card': (
      bundle ? (
        <section>
          <h3 style={{ marginBottom: 8 }}>{t('bundle.title')}</h3>
          <div className="qic-card-majlis" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>{t('bundle.selected')}: <b>{bundle.ids?.join(' + ')}</b></div>
              <div>{t('bundle.save', { percent: Math.round((bundle.savings_percent||0)*100) })}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('bundle.totalAfter', { amount: bundle.total })}</div>
          </div>
        </section>
      ) : null
    ),
    'bundle-calculator': (
      <section>
        <h3 style={{ marginBottom: 8 }}>{t('bundle.title')}</h3>
        <BundleCalculator />
      </section>
    ),
    'suggested-missions': (
      <section>
        <h3 style={{ marginBottom: 8 }}>{t('missions.suggested')}</h3>
        {loading && (<div style={{ display: 'grid', gap: 8 }}><MissionSkeleton /><MissionSkeleton /></div>)}
        {!loading && (
          <div style={{ display: 'grid', gap: 8 }}>
            {suggested.slice(0,3).map((m:any)=> (
              <MissionCard key={m.id} mission={m}
                onStart={(id)=>startMission(id).then(()=>toast.success(t('toast.missionStarted'), m.title_en || m.title || id)).catch((e)=>toast.error(t('toast.errorStart'), e?.message))}
                onComplete={(id)=>completeMission(id).then(()=>toast.success(t('toast.missionCompleted'), `+${m.xp_reward ?? 10} XP`)).catch((e)=>toast.error(t('toast.errorComplete'), e?.message))}
              />
            ))}
            {suggested.length === 0 && (
              <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DatePalmIcon size={18} color="var(--qic-secondary)" />
                <div>{t('missions.empty')}</div>
              </div>
            )}
          </div>
        )}
      </section>
    ),
    'general-missions': null,
    'rewards-offers': null
  }), [bundle, life, loading, insights, suggested, t, trend, xp, level, streak]);

  return (
    <MajlisLayout
      titleKey="health.title"
      icon={<DallahIcon size={20} color="var(--qic-secondary)" />}
      headerExtras={<span style={{ color: 'var(--qic-muted)' }}>{status}</span>}
    >
      <div className="grid-modules">
        {modules['offers-strip'] && <React.Fragment key="offers-strip">{modules['offers-strip']}</React.Fragment>}
        {modules['bundle-card'] && <React.Fragment key="bundle-card">{modules['bundle-card']}</React.Fragment>}
        {modules['bundle-calculator'] && <React.Fragment key="bundle-calculator">{modules['bundle-calculator']}</React.Fragment>}
        {order.map((k) => (modules[k] ? <React.Fragment key={k}>{modules[k]}</React.Fragment> : null))}
      </div>
      <QuoteDrawer open={quoteOpen} onClose={()=> setQuoteOpen(false)} productId={quoteProductId} />
    </MajlisLayout>
  );
}


