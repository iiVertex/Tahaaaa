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
  const userName = userProfile?.profile_json?.name || '';
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quoteProductId, setQuoteProductId] = React.useState<string | undefined>(undefined);
  // Safely extract offers array, ensuring it's always an array
  const offersRaw = (rec as any)?.product_recommendations || (rec as any)?.data?.product_recommendations || [];
  const offers = Array.isArray(offersRaw) ? offersRaw.filter((o: any) => o != null && typeof o === 'object') : [];

  const loading = loadingRewards;
  const error = errorRewards ? (t('errors.loadRewards') || 'Failed to load rewards') : null;

  return (
    <MajlisLayout titleKey="rewards.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {/* Welcome Description */}
      <div className="qic-card-majlis" style={{ 
        padding: 20, 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 152, 0, 0.15) 100%)',
        border: '2px solid #FFC107',
        borderRadius: 12
      }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
          <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>💰 Transform Your Coins Into Real Value</strong>
          <p style={{ margin: '12px 0 0 0' }}>
            Your effort deserves real rewards. Redeem your hard-earned coins for exclusive discounts, bundle deals, and special offers 
            on QIC insurance products. Create custom insurance bundles that match your needs while saving money—every coin you earn 
            brings you closer to comprehensive protection that fits your lifestyle and budget. Start saving today!
          </p>
        </div>
      </div>
      {userName && (
        <div style={{ marginBottom: 12, fontSize: 16, color: 'var(--qic-primary)', fontWeight: 500 }}>
          Hey {userName}, you have {coins.toLocaleString()} coins! 💰
        </div>
      )}
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
          onClick={async () => {
            try {
              // Check if user has recently completed a mission for context-aware message
              const { data: missionsData } = await import('@/lib/api').then(m => m.getMissions?.());
              const completedMissions = Array.isArray(missionsData) 
                ? missionsData.filter((m: any) => m.user_progress?.status === 'completed')
                : [];
              const recentCompleted = completedMissions
                .sort((a: any, b: any) => {
                  const aTime = new Date(a.user_progress?.completed_at || 0).getTime();
                  const bTime = new Date(b.user_progress?.completed_at || 0).getTime();
                  return bTime - aTime;
                })[0];
              
              // Build context for referral message
              const context: any = {};
              if (recentCompleted) {
                context.recent_mission = {
                  name: recentCompleted.title_en || recentCompleted.title,
                  coins: recentCompleted.user_progress?.coins_earned || 0,
                  lifescore: recentCompleted.user_progress?.lifescore_change || 0
                };
              }
              
              const res: any = await shareReferral(context);
              const referralMessage = res?.data?.referral_message || res?.data?.share_url || '';
              const emailSubject = res?.data?.email_subject || 'Join QIC Life';
              
              // Open email client in new tab with pre-filled message
              const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(referralMessage)}`;
              window.open(mailtoLink, '_blank');
              
              toast.success(t('rewards.referralReady') || 'Referral email opened!', 'Share your code with friends');
              track('referral_share');
            } catch (e: any) {
              toast.error(t('rewards.referralFailed') || 'Referral failed', e?.message);
            }
          }}
          style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}
        >
          {t('rewards.shareReferral') || 'Get Referral'}
        </button>
      </div>
      <QuoteDrawer open={quoteOpen} onClose={()=>{ setQuoteOpen(false); }} productId={quoteProductId} />
    </MajlisLayout>
  );
}


