import { useEffect, useState } from 'react';
import { getRemainingSpins, spinRoulette, getProfile } from '@/lib/api';
import { CardSkeleton } from '@/components/Skeletons';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCoins } from '@/lib/coins';
import RouletteWheel from '@/components/RouletteWheel';
import { getRouletteOptions } from '@/data/rouletteOptions';

export default function Play() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { refreshCoins, addCoins } = useCoins();
  const [spinning, setSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<any | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Get user profile for personalization
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const userName = (profile as any)?.userProfile?.profile_json?.name || '';
  const nationality = (profile as any)?.userProfile?.profile_json?.nationality || null;
  
  // Get wheel options based on nationality
  const wheelOptions = getRouletteOptions(nationality);

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
      setRouletteResult(null);
      setSelectedOptionId(null);
      
      const result = await spinRoulette();
      setRouletteResult(result);
      
      // Map API result to wheel option
      // Try to match by title, reward, or keywords
      if (result.wheel_spin_result) {
        const resultLower = result.wheel_spin_result.toLowerCase();
        let matchedOption = wheelOptions.find(opt => {
          const titleLower = opt.title.toLowerCase();
          const rewardLower = opt.reward.toLowerCase();
          return titleLower.includes(resultLower) ||
                 resultLower.includes(titleLower) ||
                 rewardLower.includes(resultLower) ||
                 resultLower.includes('free') && opt.id.includes('free-insurance') ||
                 resultLower.includes('coin') && opt.id.includes('coins') ||
                 (resultLower.includes('traditional') || resultLower.includes('heritage')) && opt.id.includes('qatari-itinerary') ||
                 resultLower.includes('modern') && opt.id.includes('expat-itinerary') ||
                 (resultLower.includes('futuristic') || resultLower.includes('future')) && opt.id.includes('visitor-itinerary');
        });
        
        if (matchedOption) {
          setSelectedOptionId(matchedOption.id);
        } else {
          // Fallback: select random option from wheel
          const randomOption = wheelOptions[Math.floor(Math.random() * wheelOptions.length)];
          setSelectedOptionId(randomOption.id);
        }
      } else {
        // If no API result, select random option
        const randomOption = wheelOptions[Math.floor(Math.random() * wheelOptions.length)];
        setSelectedOptionId(randomOption.id);
      }
      
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
      setSpinning(false);
    }
  };

  const handleSpinComplete = () => {
    // Wheel animation completed
    setSpinning(false);
  };

  // Handle itinerary document download
  const handleDownloadItinerary = async (option: typeof wheelOptions[0]) => {
    if (!option.documentUrl) return;
    
    try {
      const response = await fetch(option.documentUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = option.documentUrl.split('/').pop() || 'itinerary.docx';
      link.style.display = 'none';
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success(
        t('play.roulette.downloadSuccess') || 'Downloaded!',
        `${option.title} has been saved to your device.`
      );
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error(
        t('play.roulette.downloadFailed') || 'Download failed',
        'Unable to download file. Please try again later.'
      );
    }
  };

  return (
    <MajlisLayout titleKey="play.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {/* Welcome Description */}
      <div className="qic-card-majlis" style={{ 
        padding: 20, 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
        border: '2px solid var(--qic-accent)',
        borderRadius: 12
      }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
          <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>🎰 Spin to Win Amazing Rewards</strong>
          <p style={{ margin: '12px 0 0 0' }}>
            Feel the excitement as you spin the wheel and unlock incredible prizes tailored to your nationality and lifestyle! 
            Win coins, exclusive insurance offers, or personalized travel itineraries that transform your Qatar experience. 
            Every spin brings new possibilities—take your chance and see what fortune has in store for you today!
          </p>
        </div>
      </div>
      {userName && (
        <div style={{ marginBottom: 12, fontSize: 16, color: 'var(--qic-primary)', fontWeight: 500 }}>
          Hi {userName}! Ready for your daily spin? 🦅
        </div>
      )}
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

        {/* Spinning Wheel */}
        <RouletteWheel 
          options={wheelOptions}
          spinning={spinning}
          selectedOptionId={selectedOptionId}
          onSpinComplete={handleSpinComplete}
        />

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
              🎁 {selectedOptionId ? (() => {
                const selectedOption = wheelOptions.find(opt => opt.id === selectedOptionId);
                return selectedOption?.reward || rouletteResult.reward || '100 QIC Coins';
              })() : (rouletteResult.reward || '100 QIC Coins')}
            </div>

            {/* Action Buttons: Claim for Coins, Download for Itineraries */}
            {selectedOptionId && (() => {
              const selectedOption = wheelOptions.find(opt => opt.id === selectedOptionId);
              if (!selectedOption) return null;

              // Show Claim button for coins
              if (selectedOption.id.includes('coins')) {
                return (
                  <button
                    onClick={async () => {
                      try {
                        await addCoins(100);
                        await refreshCoins();
                        toast.success(
                          t('play.roulette.coinsClaimed') || 'Coins Claimed!',
                          '100 QIC Coins have been added to your account.'
                        );
                      } catch (error) {
                        toast.error(
                          t('play.roulette.claimFailed') || 'Claim Failed',
                          'Unable to add coins. Please try again.'
                        );
                      }
                    }}
                    style={{
                      marginTop: 16,
                      padding: '12px 24px',
                      background: 'rgba(255, 215, 0, 0.3)',
                      color: 'white',
                      border: '2px solid rgba(255, 215, 0, 0.6)',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 215, 0, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 215, 0, 0.3)';
                    }}
                  >
                    ✅ Claim 100 QIC Coins
                  </button>
                );
              }

              // Show Download button for itineraries
              if (selectedOption.documentUrl) {
                return (
                  <button
                    onClick={() => handleDownloadItinerary(selectedOption)}
                    style={{
                      marginTop: 16,
                      padding: '12px 24px',
                      background: 'rgba(255, 255, 255, 0.25)',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.5)',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    }}
                  >
                    📥 Download {selectedOption.title}
                  </button>
                );
              }

              return null;
            })()}
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


