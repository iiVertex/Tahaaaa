import React, { useEffect, useState } from 'react';
import { getRewards, redeemReward, getProfile, getRecommendations, shareReferral } from '@/lib/api';
import ProductOfferCard from '@/components/ProductOfferCard';
import { track } from '@/lib/analytics';
import RewardCard from '@/components/RewardCard';
import { CardSkeleton } from '@/components/Skeletons';
import { motion } from 'framer-motion';
import { rewardUnlockVariants } from '@/lib/animations';
import { useToast } from '@/components/Toast';
import QuoteDrawer from '@/components/QuoteDrawer';
import BundleCalculator from '@/components/BundleCalculator';
import { useTranslation } from 'react-i18next';
import { DatePalmIcon } from '@/components/QatarAssets';
import MajlisLayout from '@/components/MajlisLayout';

export default function Rewards() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [offers, setOffers] = useState<any[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteProductId, setQuoteProductId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRewards().catch(() => { setError(t('errors.loadRewards')); return []; }),
      getProfile().catch(() => null),
      // Debounce AI recommendations to avoid rate limiting
      new Promise(resolve => {
        setTimeout(() => {
          getRecommendations().catch(()=>({})).then(resolve);
        }, 100);
      })
    ])
      .then(([list, prof, rec]) => {
        setRewards(list || []);
        const c = (prof as any)?.user?.coins ?? (prof as any)?.stats?.coins ?? 0;
        setCoins(c);
        const prs = (rec as any)?.product_recommendations || [];
        setOffers(prs);
      })
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <MajlisLayout titleKey="rewards.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <motion.span variants={rewardUnlockVariants} initial="initial" animate="animate" style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 9999, background: 'var(--qic-accent)' }} />
        <div>{t('rewards.coinsBalance', { amount: coins })}</div>
      </div>
      {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      {offers && offers.length > 0 && (
        <div className="qic-card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('offers.recommended')}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {offers.slice(0,2).map((o:any)=> (
              <ProductOfferCard key={`rw-${o.product_id}`} offer={o} onCta={(offer)=>{ track('offer_click', { product_id: offer.product_id }); setQuoteProductId(offer.product_id); setQuoteOpen(true); }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <BundleCalculator onStartQuote={(ids)=>{ if (ids && ids.length>0) { setQuoteProductId(ids[0]); setQuoteOpen(true);} }} />
      </div>
      <div className="grid-rewards">
        {rewards.map((r) => (
          <RewardCard key={r.id} reward={r} userCoins={coins} onRedeem={(id)=>redeemReward(id)
            .then(()=> toast.success(t('rewards.redeemedToast'), r.title_en || r.title || ''))
            .catch((e)=> toast.error(t('rewards.redeemFailed'), e?.message))} />
        ))}
        {(!loading && !error && rewards.length === 0) && (
          <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatePalmIcon size={18} color="var(--qic-secondary)" />
            <div>{t('rewards.empty')}</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => {
            shareReferral().then((res:any)=>{
              toast.success(t('rewards.referralReady'), res?.data?.share_url || '');
              track('referral_share');
            }).catch((e)=> toast.error(t('rewards.referralFailed'), e?.message));
          }}
          style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}
        >
          {t('rewards.shareReferral')}
        </button>
      </div>
      <QuoteDrawer open={quoteOpen} onClose={()=> setQuoteOpen(false)} productId={quoteProductId} />
    </MajlisLayout>
  );
}


