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

  const { data: rewardsData, isLoading: loadingRewards, isError: errorRewards, error: rewardsError } = useQuery({ 
    queryKey: ['rewards'], 
    queryFn: getRewards,
    retry: 2,
    retryDelay: 1000
  });
  
  // Ensure rewards is always an array
  const rewards = React.useMemo(() => {
    if (!rewardsData) return [];
    if (Array.isArray(rewardsData)) return rewardsData;
    if (Array.isArray(rewardsData?.data?.rewards)) return rewardsData.data.rewards;
    if (Array.isArray(rewardsData?.rewards)) return rewardsData.rewards;
    return [];
  }, [rewardsData]);
  
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  // Safe profile data extraction with null checks
  const profileData = profile as any;
  const userProfile = profileData?.data?.userProfile || profileData?.userProfile || null;
  const userData = profileData?.data?.user || profileData?.user || null;
  const prefs = userProfile?.profile_json?.preferences || null;
  const { data: rec } = useQuery({ 
    queryKey: ['ai','recommendations', prefs], 
    queryFn: () => getRecommendationsContext({ preferences: prefs }),
    enabled: !!prefs // Only fetch if preferences exist
  });

  // Safely extract coins with multiple fallback paths
  const coins = userData?.coins ?? 
                profileData?.coins ?? 
                (userProfile?.profile_json as any)?.coins ?? 
                0;
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quoteProductId, setQuoteProductId] = React.useState<string | undefined>(undefined);
  // Safely extract offers array, ensuring it's always an array
  const offersRaw = (rec as any)?.product_recommendations || (rec as any)?.data?.product_recommendations || [];
  const offers = Array.isArray(offersRaw) ? offersRaw.filter((o: any) => o != null && typeof o === 'object') : [];

  const loading = loadingRewards;
  const error = errorRewards ? (t('errors.loadRewards') || 'Failed to load rewards') : null;

  return (
    <MajlisLayout titleKey="rewards.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <motion.span variants={rewardUnlockVariants} initial="initial" animate="animate" style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 9999, background: 'var(--qic-accent)' }} />
        <div>{t('rewards.coinsBalance', { amount: coins })}</div>
      </div>
      {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {error && (
        <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#ffebee', border: '1px solid #ef5350', color: '#c62828' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Error Loading Rewards</div>
          <div style={{ fontSize: 14 }}>{error}</div>
          {rewardsError && (
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
              {(rewardsError as any)?.message || 'Please try refreshing the page'}
            </div>
          )}
        </div>
      )}
      {offers && Array.isArray(offers) && offers.length > 0 && (
        <div className="qic-card" style={{ padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('offers.recommended')}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {offers
              .filter((offer: any) => offer && offer.product_id) // Ensure offer is valid
              .map((offer: any) => (
                <div key={offer.product_id || `offer-${Date.now()}`} className="qic-card" style={{ padding: 12 }}>
                  <ProductOfferCard offer={offer} onCta={(o)=>{ if (o?.product_id) { setQuoteProductId(o.product_id); setQuoteOpen(true); } }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => { if (offer?.product_id) { setQuoteProductId(offer.product_id); setQuoteOpen(true); } }}>
                      {t('quote.getQuote')}
                    </button>
                    <button onClick={async ()=>{
                      if (!offer?.product_id) return;
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
        {Array.isArray(rewards) && rewards.length > 0 && rewards
          .filter((r: any) => r != null && typeof r === 'object' && r.id) // Filter out invalid rewards
          .map((r: any) => {
            try {
              return (
                <RewardCard 
                  key={r.id} 
                  reward={r} 
                  userCoins={coins} 
                  onRedeem={(id) => {
                    if (!id) return;
                    redeemReward(id)
                      .then(() => { 
                        toast.success(t('rewards.redeemedToast') || 'Reward redeemed', r.title_en || r.title || r.id); 
                        qc.invalidateQueries({ queryKey: ['rewards'] });
                        qc.invalidateQueries({ queryKey: ['profile'] }); // Refresh profile to update coins
                      })
                      .catch((e: any) => toast.error(t('rewards.redeemFailed') || 'Failed to redeem reward', e?.message || 'Unknown error'));
                  }} 
                />
              );
            } catch (error) {
              console.error('[Rewards] Error rendering reward card:', r, error);
              return null;
            }
          })}
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


