import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCoins } from '@/lib/coins';
import { useToast } from '@/components/Toast';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useQueryClient } from '@tanstack/react-query';

type Mission = {
  id: string;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  category?: string;
  difficulty?: string;
  xp_reward?: number;
  lifescore_impact?: number;
  coin_reward?: number;
};

type ChallengeViewProps = {
  mission: Mission | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (missionId: string) => Promise<void>;
  userName?: string;
};

export default function ChallengeView({ mission, isOpen, onClose, onComplete, userName }: ChallengeViewProps) {
  const { t } = useTranslation();
  const { coins, addCoins, refreshCoins } = useCoins();
  const toast = useToast();
  const qc = useQueryClient();
  const [interactions, setInteractions] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [treeSize, setTreeSize] = useState(0); // For "water your life tree" missions
  const [missionSteps, setMissionSteps] = useState<Array<{ step_number: number; title: string; description: string }>>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  // Fetch mission steps from backend when mission changes
  useEffect(() => {
    if (mission?.id && isOpen) {
      setLoadingSteps(true);
      // Import dynamically to avoid circular deps
      import('@/lib/api').then(({ getMissionSteps }) => {
        getMissionSteps(mission.id)
          .then((response: any) => {
            const steps = response?.steps || response?.data?.steps || [];
            if (Array.isArray(steps) && steps.length > 0) {
              // Sort by step_number and ensure exactly 3 steps
              const sortedSteps = steps
                .sort((a: any, b: any) => (a.step_number || 0) - (b.step_number || 0))
                .slice(0, 3);
              setMissionSteps(sortedSteps);
            } else {
              // If no steps from backend, use empty array (will show generic steps)
              setMissionSteps([]);
            }
            setLoadingSteps(false);
          })
          .catch((error: any) => {
            console.warn('Failed to fetch mission steps:', error);
            setMissionSteps([]); // Fallback to empty - will use generic steps
            setLoadingSteps(false);
          });
      });
    } else {
      setMissionSteps([]);
      setLoadingSteps(false);
    }
  }, [mission?.id, isOpen]);

  // Reset state when mission changes
  useEffect(() => {
    if (mission) {
      setInteractions(0);
      setCompletedSteps(new Set());
      setTreeSize(0);
    }
  }, [mission?.id]);

  if (!mission) return null;

  const isGameRelated = mission.category && ['safe_driving', 'lifestyle'].includes(mission.category);
  const missionText = `${mission.title || ''} ${mission.title_en || ''} ${mission.description || ''} ${mission.description_en || ''}`.toLowerCase();
  const isLifeTreeMission = missionText.includes('tree') || 
                            missionText.includes('water') || 
                            missionText.includes('life tree') ||
                            missionText.includes('plant');

  // Coin rewards by difficulty
  const coinRewardByDifficulty: Record<string, number> = {
    easy: 10,
    medium: 20,
    hard: 30,
    expert: 30
  };
  const finalCoinReward = coinRewardByDifficulty[mission.difficulty || 'easy'] || 10;

  // Handle interaction (add 1 coin)
  const handleInteraction = async (action: 'add' | 'subtract') => {
    if (action === 'add') {
      await addCoins(1); // Award 1 coin immediately
      setInteractions(prev => prev + 1);
    } else {
      // Subtract not used in current flow, but keeping for future
      await addCoins(-1);
      setInteractions(prev => prev + 1);
    }
  };

  // Handle step completion (for non-game missions)
  const handleStepComplete = async (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) return;
    
    const newSteps = new Set(completedSteps);
    newSteps.add(stepIndex);
    setCompletedSteps(newSteps);
    
    // Add 1 coin per step
    await handleInteraction('add');
    
    toast?.success?.(`Step ${stepIndex + 1} completed! +1 coin`);
  };

  // Handle tree watering (for life tree missions)
  const handleWaterTree = async () => {
    if (treeSize >= 50) {
      toast?.info?.('Tree is fully grown! Complete the mission to claim rewards.');
      return;
    }
    
    // Increment by 1 per click (not 5)
    const newSize = Math.min(50, treeSize + 1);
    setTreeSize(newSize);
    await handleInteraction('add'); // Award 1 coin per click
    
    if (newSize === 50) {
      toast?.success?.('✅ Tree successfully planted and grown!');
    }
  };

  // Handle mission completion
  const handleCompleteMission = async () => {
    if (!canComplete) {
      toast?.error?.('Please complete all requirements before finishing the mission');
      return;
    }
    
    try {
      const result = await onComplete(mission.id);
      await refreshCoins();
      
      // Invalidate and refetch missions to update the UI immediately
      await qc.invalidateQueries({ queryKey: ['missions'] });
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.refetchQueries({ queryKey: ['missions'] });
      await qc.refetchQueries({ queryKey: ['profile'] });
      
      // Extract reward information from result
      const coinsGained = result?.data?.coinsResult?.coinsGained || result?.data?.coins || finalCoinReward;
      const xpGained = result?.data?.xpResult?.xpGained || result?.data?.xp || mission.xp_reward || 10;
      const achievements = result?.data?.achievements_unlocked || [];
      
      toast?.success?.(`Mission completed! +${coinsGained} coins, +${xpGained} XP earned!`);
      
      if (achievements.length > 0) {
        achievements.forEach((ach: any) => {
          toast?.success?.(`Achievement unlocked: ${ach.name_en || 'Achievement'}!`, `+${ach.xp_reward || 0} XP, +${ach.coin_reward || 0} coins`);
        });
      }
      
      // Close after short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      const errorMsg = error?.message || error?.response?.data?.message || 'Failed to complete mission';
      
      // Provide more helpful error messages
      let displayMsg = errorMsg;
      if (errorMsg.includes('not started') || errorMsg.includes('already completed')) {
        displayMsg = 'This mission may have already been completed or hasn\'t been started properly. Please refresh and try again.';
      } else if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
        displayMsg = 'Too many requests. Please wait a moment and try again.';
      }
      
      toast?.error?.('Mission Completion Failed', displayMsg);
      console.error('Mission completion error:', error);
    }
  };

  // Calculate completion status
  const allStepsCompleted = !isGameRelated && !isLifeTreeMission && completedSteps.size >= 3;
  const treeFullyGrown = isLifeTreeMission && treeSize >= 50;
  const gameInteractionsDone = isGameRelated && !isLifeTreeMission && interactions >= 5;
  const canComplete = allStepsCompleted || treeFullyGrown || gameInteractionsDone;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0, 0, 0, 0.5)', 
            zIndex: 50 
          }} 
        />
        <Dialog.Content 
          style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 51,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
        >
          {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <Dialog.Title style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--qic-primary)' }}>
                    {mission.title_en || mission.title}
                  </Dialog.Title>
                  {userName && (
                    <div style={{ fontSize: 14, color: 'var(--qic-muted)', marginBottom: 12 }}>
                      Hi {userName}! Let's tackle this challenge together.
                    </div>
                  )}
                  <div style={{ fontSize: 16, color: '#666', lineHeight: 1.6 }}>
                    {mission.description_en || mission.description}
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: 24,
                      cursor: 'pointer',
                      padding: 4,
                      lineHeight: 1,
                      color: '#666',
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </Dialog.Close>
              </div>

              {/* Coins Display */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 8,
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>💰 Your Coins:</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--qic-accent)' }}>
                    {coins.toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>
                  {interactions} interaction{interactions !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Life Tree Mission UI */}
              {isLifeTreeMission && (
                <div style={{ marginBottom: 20 }}>
                  {/* Initial message when treeSize is 0 */}
                  {treeSize === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: 20, 
                      background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                      borderRadius: 12,
                      marginBottom: 16,
                      border: '2px solid #ff9800'
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#e65100' }}>
                        Seed planted. Tap to grow Tree
                      </div>
                    </div>
                  )}
                  
                  {/* Progress display when treeSize > 0 */}
                  {treeSize > 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: 20, 
                      background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                      borderRadius: 12,
                      marginBottom: 16
                    }}>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                        🌳 Your Life Tree
                      </div>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>
                        {treeSize < 10 ? '🌱' : treeSize < 25 ? '🌿' : treeSize < 50 ? '🌳' : '🌲'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#2e7d32', marginBottom: 8 }}>
                        Tree: {treeSize}/50
                      </div>
                      
                      {/* Completion message */}
                      {treeSize >= 50 && (
                        <div style={{ 
                          fontSize: 16, 
                          fontWeight: 700, 
                          color: '#1b5e20',
                          marginTop: 12,
                          padding: 12,
                          background: '#c8e6c9',
                          borderRadius: 8
                        }}>
                          ✅ Tree successfully planted and grown
                        </div>
                      )}
                      
                      <div style={{ 
                        width: '100%', 
                        height: 8, 
                        background: '#e0e0e0', 
                        borderRadius: 4,
                        marginTop: 12,
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${(treeSize / 50) * 100}%`, 
                          height: '100%', 
                          background: '#4caf50',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleWaterTree}
                    disabled={treeSize >= 50}
                    style={{
                      width: '100%',
                      padding: 16,
                      background: treeSize >= 50 ? '#ccc' : 'var(--qic-secondary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: treeSize >= 50 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {treeSize >= 50 ? '✅ Tree Fully Grown!' : '🌱 Water Tree'}
                  </button>
                </div>
              )}

                     {/* Non-Game Mission: 3-Step Checklist */}
                     {!isGameRelated && !isLifeTreeMission && (
                       <div style={{ marginBottom: 20 }}>
                         <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                           Complete these 3 steps:
                         </div>
                         {loadingSteps ? (
                           <div style={{ padding: 20, textAlign: 'center', color: 'var(--qic-muted)' }}>
                             Loading mission steps...
                           </div>
                         ) : (
                           <div style={{ display: 'grid', gap: 12 }}>
                             {(missionSteps.length > 0 ? missionSteps : [
                               { step_number: 1, title: 'Review your insurance needs', description: 'Assess your current coverage' },
                               { step_number: 2, title: 'Explore QIC products matching your needs', description: 'Find relevant insurance options' },
                               { step_number: 3, title: 'Take action: Get a quote or schedule consultation', description: 'Connect with QIC advisors' }
                             ]).map((step: any, idx: number) => {
                               const stepIndex = step.step_number - 1; // Convert to 0-based index
                               const isCompleted = completedSteps.has(stepIndex);
                               return (
                                 <div
                                   key={step.step_number || idx + 1}
                                   style={{
                                     display: 'flex',
                                     alignItems: 'center',
                                     gap: 12,
                                     padding: 16,
                                     background: isCompleted ? '#e8f5e9' : '#f5f5f5',
                                     border: `2px solid ${isCompleted ? '#4caf50' : '#ddd'}`,
                                     borderRadius: 8,
                                     cursor: isCompleted ? 'default' : 'pointer',
                                     transition: 'all 0.2s'
                                   }}
                                   onClick={() => !isCompleted && handleStepComplete(stepIndex)}
                                 >
                                   <div style={{
                                     width: 32,
                                     height: 32,
                                     borderRadius: '50%',
                                     background: isCompleted ? '#4caf50' : '#ddd',
                                     color: isCompleted ? 'white' : '#666',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     fontSize: 18,
                                     fontWeight: 600,
                                     flexShrink: 0
                                   }}>
                                     {isCompleted ? '✓' : step.step_number || idx + 1}
                                   </div>
                                   <div style={{ flex: 1 }}>
                                     <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                       {step.title || `Step ${step.step_number || idx + 1}`}
                                     </div>
                                     <div style={{ fontSize: 14, color: '#666' }}>
                                       {step.description || step.title || 'Complete this step'}
                                     </div>
                                   </div>
                                   {!isCompleted && (
                                     <button
                                       style={{
                                         padding: '8px 16px',
                                         background: 'var(--qic-secondary)',
                                         color: 'white',
                                         border: 'none',
                                         borderRadius: 6,
                                         fontSize: 14,
                                         fontWeight: 600,
                                         cursor: 'pointer'
                                       }}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleStepComplete(stepIndex);
                                       }}
                                     >
                                       Complete (+1 coin)
                                     </button>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                         )}
                       </div>
                     )}

              {/* Game-Related Mission: 5+ Dynamic Interactions */}
              {isGameRelated && !isLifeTreeMission && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
                    Interactive Challenge - Complete {Math.max(5, interactions)} actions:
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12 
                  }}>
                    {[
                      { label: '✅ Check Safety', action: () => handleInteraction('add'), icon: '🛡️' },
                      { label: '📊 Review Stats', action: () => handleInteraction('add'), icon: '📈' },
                      { label: '🎯 Set Goal', action: () => handleInteraction('add'), icon: '🎪' },
                      { label: '📝 Take Notes', action: () => handleInteraction('add'), icon: '📋' },
                      { label: '💡 Get Tips', action: () => handleInteraction('add'), icon: '💡' },
                      { label: '📷 Share Progress', action: () => handleInteraction('add'), icon: '📸' },
                      { label: '🔔 Set Reminder', action: () => handleInteraction('add'), icon: '⏰' },
                      { label: '🏆 View Achievements', action: () => handleInteraction('add'), icon: '🏅' }
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        onClick={item.action}
                        style={{
                          padding: 16,
                          background: 'linear-gradient(135deg, var(--qic-secondary) 0%, var(--qic-accent) 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 32,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        <span>{item.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginTop: 12, textAlign: 'center' }}>
                    Each interaction adds 1 coin. Complete at least 5 to finish!
                  </div>
                </div>
              )}

              {/* Rewards Preview */}
              <div style={{ 
                padding: 16, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 8,
                marginBottom: 20,
                color: 'white'
              }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  🎁 Completion Rewards
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
                  <div>💰 +{finalCoinReward} Coins</div>
                  <div>⭐ +{mission.xp_reward || 10} XP</div>
                  <div>📈 +{mission.lifescore_impact || 5} LifeScore</div>
                </div>
              </div>

              {/* Complete Button */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleCompleteMission}
                  disabled={!canComplete}
                  style={{
                    flex: 1,
                    padding: 16,
                    background: canComplete ? 'var(--qic-secondary)' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: canComplete ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  {canComplete 
                    ? `✨ Complete Mission (+${finalCoinReward} coins)` 
                    : isLifeTreeMission 
                    ? (treeSize >= 50 ? '✅ Tree fully grown! Complete mission' : `🌳 Keep watering! (${treeSize}/50)`)
                    : !isGameRelated 
                    ? `Complete all 3 steps (${completedSteps.size}/3)`
                    : `Complete ${Math.max(0, 5 - interactions)} more actions`}
                </button>
              </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

