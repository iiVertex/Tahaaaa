import React from 'react';
import { getRewards, redeemReward, getProfile, getRecommendationsContext, shareReferral, recordPurchase } from '@/lib/api';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function Rewards() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: rewards = [], isLoading: loadingRewards, isError: errorRewards } = useQuery({ queryKey: ['rewards'], queryFn: getRewards });
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const prefs = (profile as any)?.userProfile?.profile_json?.preferences || null;
  const { data: rec } = useQuery({ queryKey: ['ai','recommendations', prefs], queryFn: () => getRecommendationsContext({ preferences: prefs }) });

  const coins = (profile as any)?.user?.coins || 0;
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quoteProductId, setQuoteProductId] = React.useState<string | undefined>(undefined);
  const offers = (rec as any)?.product_recommendations || [];

  const loading = loadingRewards;
  const error = errorRewards ? t('errors.loadRewards') : null;

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
            {offers.map((offer: any) => (
              <div key={offer.product_id} className="qic-card" style={{ padding: 12 }}>
                <ProductOfferCard offer={offer} onCta={(o)=>{ setQuoteProductId(o.product_id); setQuoteOpen(true); }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setQuoteProductId(offer.product_id); setQuoteOpen(true); }}>
                    {t('quote.getQuote')}
                  </button>
                  <button onClick={async ()=>{
                    try {
                      await recordPurchase({
                        product_id: offer.product_id,
                        product_type: (offer.type || 'motor_insurance'),
                        product_name: offer.name || offer.product_id,
                        purchase_amount: Math.max(offer.estimated_premium || 50, 10),
                        currency: t('currency') as any,
                        metadata: { source: 'rewards_offer' }
                      });
                      toast.success(t('purchase.recorded') || 'Purchase recorded');
                      qc.invalidateQueries({ queryKey: ['profile'] });
                    } catch (e:any) {
                      toast.error(t('purchase.failed') || 'Purchase failed', e?.message);
                    }
                  }}>
                    {t('purchase.record')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <BundleCalculator onStartQuote={(ids)=>{ if (ids && ids.length>0) { setQuoteProductId(ids[0]); setQuoteOpen(true); } }} />
      </div>
      <div className="grid-rewards">
        {rewards.map((r: any) => (
          <RewardCard key={r.id} reward={r} userCoins={coins} onRedeem={(id)=>redeemReward(id)
            .then(()=> { toast.success(t('rewards.redeemedToast'), r.title_en || r.title || ''); qc.invalidateQueries({ queryKey: ['rewards'] }); })
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
      <QuoteDrawer open={quoteOpen} onClose={()=>{ setQuoteOpen(false); }} productId={quoteProductId} />
    </MajlisLayout>
  );
}


