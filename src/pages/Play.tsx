import { useEffect, useState } from 'react';
import { getRemainingSpins, spinRoulette } from '@/lib/api';
import { CardSkeleton } from '@/components/Skeletons';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCoins } from '@/lib/coins';

export default function Play() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { refreshCoins } = useCoins();
  const [spinning, setSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<any | null>(null);

  // Get remaining spins
  const { data: spinsData, refetch: refetchSpins } = useQuery({
    queryKey: ['rouletteSpins'],
    queryFn: getRemainingSpins,
    refetchOnMount: true,
    staleTime: 30 * 1000, // Refetch every 30 seconds
  });
  const remainingSpins = (spinsData as any)?.remaining || 0;
  const canSpin = (spinsData as any)?.canSpin ?? (remainingSpins > 0);

  const handleSpin = async () => {
    if (!canSpin || spinning) return;
    
    try {
      setSpinning(true);
      const result = await spinRoulette();
      setRouletteResult(result);
      
      // Award coins and XP (refresh from backend)
      await refreshCoins();
      
      toast.success(
        t('play.roulette.spinSuccess') || 'Spin successful!', 
        `${result.reward || '100 QIC Coins'} - ${result.remaining || 0} spins remaining`
      );
      
      // Refetch remaining spins
      await refetchSpins();
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Failed to spin';
      if (errorMsg.includes('limit reached') || errorMsg.includes('429')) {
        toast.error(t('play.roulette.limitReached') || 'Daily spin limit reached (3 spins/day). Try again tomorrow!');
      } else {
        toast.error(t('play.roulette.spinFailed') || 'Failed to spin roulette', errorMsg);
      }
    } finally {
      setSpinning(false);
    }
  };

  return (
    <MajlisLayout titleKey="play.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {/* Road-Trip Roulette Section */}
      <div className="qic-card" style={{ padding: 20, marginBottom: 20, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 16 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🦅</div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 24, fontWeight: 700 }}>{t('play.roulette.title') || 'Road-Trip Roulette'}</h2>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 16 }}>
          {t('play.roulette.description') || 'Spin the falcon wheel for a personalized 48-hour Qatari adventure itinerary!'}
        </div>
        
        {/* Spins Remaining */}
        <div style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>
          {t('play.roulette.spinsRemaining') || 'Spins remaining'}: <span style={{ color: '#FFD700' }}>{remainingSpins}/3</span>
        </div>

        {/* Spin Button */}
        <button
          onClick={handleSpin}
          disabled={!canSpin || spinning}
          style={{
            padding: '16px 32px',
            fontSize: 18,
            fontWeight: 700,
            background: canSpin ? '#FFD700' : '#888',
            color: canSpin ? '#111' : '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: canSpin && !spinning ? 'pointer' : 'not-allowed',
            opacity: spinning ? 0.7 : 1,
            transition: 'all 0.3s',
            minWidth: 200
          }}
        >
          {spinning ? (t('play.roulette.spinning') || 'Spinning...') : canSpin ? (t('play.roulette.spinButton') || '🦅 Spin the Falcon Wheel') : (t('play.roulette.limitReached') || 'Limit Reached')}
        </button>

        {/* Roulette Result */}
        {rouletteResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 24,
              padding: 20,
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              backdropFilter: 'blur(10px)'
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
              {rouletteResult.wheel_spin_result || 'Doha Adventure'}
            </div>
            
            {/* Itinerary */}
            {rouletteResult.itinerary && rouletteResult.itinerary.length > 0 && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('play.roulette.itinerary') || '48-Hour Itinerary:'}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {rouletteResult.itinerary.map((step: string, idx: number) => (
                    <div key={idx} style={{ fontSize: 14, padding: '8px 12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6 }}>
                      <span style={{ fontWeight: 600 }}>{idx + 1}.</span> {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            {rouletteResult.ctas && rouletteResult.ctas.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('play.roulette.quickActions') || 'Quick Actions:'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rouletteResult.ctas.map((cta: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        // Handle CTA actions (can be expanded later)
                        toast.info(t('play.roulette.ctaClicked') || 'Action clicked', cta);
                      }}
                      style={{
                        padding: '10px 16px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {cta}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reward */}
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', marginTop: 16, padding: '12px 16px', background: 'rgba(255, 215, 0, 0.2)', borderRadius: 8 }}>
              🎁 {rouletteResult.reward || '100 QIC Coins'}
            </div>
          </motion.div>
        )}
      </div>

      {/* Instructions */}
      <div className="qic-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('play.roulette.howItWorks') || 'How It Works'}</div>
        <div style={{ fontSize: 14, color: 'var(--qic-muted)', lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>🦅 <strong>{t('play.roulette.step1') || 'Step 1:'}</strong> {t('play.roulette.step1Desc') || 'Spin the falcon wheel to generate your personalized adventure'}</div>
          <div style={{ marginBottom: 8 }}>🗺️ <strong>{t('play.roulette.step2') || 'Step 2:'}</strong> {t('play.roulette.step2Desc') || 'Get a 48-hour itinerary tailored to your profile and Qatari locations'}</div>
          <div style={{ marginBottom: 8 }}>🎯 <strong>{t('play.roulette.step3') || 'Step 3:'}</strong> {t('play.roulette.step3Desc') || 'Use quick actions to book services, add insurance, and earn rewards'}</div>
          <div>💰 <strong>{t('play.roulette.step4') || 'Step 4:'}</strong> {t('play.roulette.step4Desc') || 'Earn QIC Coins and unlock multi-product bundle benefits!'}</div>
        </div>
      </div>
    </MajlisLayout>
  );
}


