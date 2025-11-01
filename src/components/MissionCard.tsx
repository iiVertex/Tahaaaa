import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import { DatePalmIcon, DallahIcon, IslamicStarPattern } from '@/components/QatarAssets';
import * as Popover from '@radix-ui/react-popover';
import { trackFeatureUsageThrottled, getMissionSteps } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

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
  ai_rationale?: string;
  product_spotlight?: { product_id: string; name?: string } | boolean;
  user_progress?: {
    status?: string;
    progress?: number;
    started_at?: string;
  };
};

export default function MissionCard({ mission, onStart, onComplete, loading, aiPick, disabled, userDifficultyPreference, autoExpandSteps }: { 
  mission: Mission; 
  onStart: (id:string)=>Promise<void>|void; 
  onComplete: (id:string)=>Promise<void>|void; 
  loading?: boolean; 
  aiPick?: boolean;
  disabled?: boolean; // Disable start button if another mission is active
  userDifficultyPreference?: string; // User's profile difficulty preference for coin rewards
  autoExpandSteps?: boolean; // Auto-expand steps when mission is just started (from Showcase redirect)
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState<'start'|'complete'|null>(null);
  const [done, setDone] = React.useState(false);
  const [showSteps, setShowSteps] = React.useState(false);
  
  const isActive = mission.user_progress?.status === 'active' || mission.user_progress?.status === 'started';
  const isCompleted = mission.user_progress?.status === 'completed';
  const progress = mission.user_progress?.progress || 0;
  
  // Determine mission status for badge
  const missionStatus = React.useMemo(() => {
    if (isCompleted) return { label: 'Completed', color: '#757575', bg: '#e0e0e0', icon: '✓' };
    if (isActive && progress > 0 && progress < 100) return { label: `In Progress (${progress}%)`, color: '#f57c00', bg: '#fff3e0', icon: '⟳' };
    if (isActive) return { label: 'Active', color: '#2e7d32', bg: '#c8e6c9', icon: '●' };
    return { label: 'Available', color: '#1976d2', bg: '#bbdefb', icon: '→' };
  }, [isActive, isCompleted, progress]);
  
  // Auto-expand steps if mission was just started (from Showcase redirect) and is now active
  React.useEffect(() => {
    if (autoExpandSteps && isActive && !showSteps) {
      setShowSteps(true);
    }
  }, [autoExpandSteps, isActive, showSteps]);
  
  // Fetch steps if mission is active OR if user clicked to show steps
  const { data: stepsData } = useQuery({
    queryKey: ['mission-steps', mission.id],
    queryFn: () => getMissionSteps(mission.id),
    enabled: isActive || showSteps, // Fetch if active OR if user wants to see steps
    refetchOnMount: true,
  });
  
  const steps = (stepsData as any)?.data?.steps || (stepsData as any)?.steps || [];
  
  const categoryIcon = React.useMemo(() => {
    switch (mission.category) {
      case 'health': return <DatePalmIcon size={14} color={'var(--qic-secondary)'} />;
      case 'wellness': return <DallahIcon size={14} color={'var(--qic-secondary)'} />;
      case 'safe_driving': return <IslamicStarPattern size={14} color={'var(--qic-secondary)'} />;
      default: return <IslamicStarPattern size={14} color={'var(--qic-secondary)'} />;
    }
  }, [mission.category]);
  
  const stars = React.useMemo(() => {
    const d = (mission.difficulty || 'easy').toLowerCase();
    const count = d === 'hard' ? 3 : d === 'medium' ? 2 : 1;
    return Array.from({ length: count }).map((_, i) => (
      <span key={i} aria-hidden>★</span>
    ));
  }, [mission.difficulty]);
  
  // Calculate coin reward based on user's profile difficulty preference (easy=10, medium=20, hard=30)
  const coinReward = React.useMemo(() => {
    // If user's difficulty preference is provided, use it instead of mission difficulty
    if (userDifficultyPreference) {
      const difficultyMap: Record<string, number> = { easy: 10, medium: 20, hard: 30, expert: 30 };
      return difficultyMap[userDifficultyPreference] || 10;
    }
    // Fallback to mission coin_reward or mission difficulty
    if (mission.coin_reward !== undefined && mission.coin_reward !== null) {
      return mission.coin_reward;
    }
    const difficultyMap: Record<string, number> = { easy: 10, medium: 20, hard: 30, expert: 30 };
    return difficultyMap[mission.difficulty || 'easy'] || 10;
  }, [mission.coin_reward, mission.difficulty, userDifficultyPreference]);
  
  const handleStart = async () => {
    try { 
      setBusy('start'); 
      await onStart(mission.id); 
      await trackFeatureUsageThrottled('mission_start', { mission_id: mission.id });
      // Do NOT auto-show steps here - steps will auto-expand on Missions page after redirect
    } finally { 
      setBusy(null); 
    }
  };
  
  const handleComplete = async () => {
    try { 
      setBusy('complete'); 
      await onComplete(mission.id); 
      await trackFeatureUsageThrottled('mission_complete', { mission_id: mission.id }); 
      setDone(true);
    } finally { 
      setBusy(null); 
    }
  };
  
  return (
    <motion.div className="qic-card" style={{ padding: 12, opacity: done ? 0.6 : 1, position: 'relative' }} variants={cardEntranceVariants} initial="initial" animate="animate">
      {/* Status Badge - Top Right */}
      <div 
        aria-label={`Mission status: ${missionStatus.label}`}
        style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: missionStatus.bg, 
          color: missionStatus.color, 
          fontSize: 10, 
          fontWeight: 600,
          padding: '4px 8px', 
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          border: `1px solid ${missionStatus.color}`
        }}
      >
        <span>{missionStatus.icon}</span>
        <span>{missionStatus.label}</span>
      </div>
      
      {mission.product_spotlight ? (
        <div aria-label="Product spotlight" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--qic-accent)', color: '#111', fontSize: 10, padding: '2px 6px', borderRadius: 6 }}>
          {t('spotlight')}
        </div>
      ) : null}
      {aiPick ? (
        <div aria-label="AI Pick" style={{ position: 'absolute', top: mission.product_spotlight ? 28 : 8, left: 8, background: 'var(--qic-secondary)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 6 }}>
          {t('ai.pickLabel') || 'AI Pick'}
        </div>
      ) : null}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {categoryIcon}
            <b>{mission.title_en || mission.title || mission.id}</b>
          </div>
          <div style={{ opacity: 0.8 }}>{mission.description_en || mission.description}</div>
          <div style={{ opacity: 0.7, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{t('rewards.coins') || 'Coins'}: +{coinReward}</span>
            <span>· {t('stats.xp') || 'XP'}: +{mission.xp_reward ?? 10}</span>
            <span aria-label={`Difficulty ${mission.difficulty || 'easy'}`} style={{ color: 'var(--qic-secondary)' }}>{stars}</span>
          </div>
          
          {/* Progress Bar for Active Missions */}
          {isActive && progress > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: missionStatus.bg, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
          
          {/* Show 3-step plan if mission is active OR user just started it */}
          {(isActive || showSteps) && (
            <div style={{ marginTop: 12, padding: 10, background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>3-Step Execution Plan</div>
                <button 
                  onClick={() => setShowSteps(!showSteps)}
                  style={{ 
                    fontSize: 12, 
                    background: 'transparent', 
                    border: '1px solid #ddd', 
                    padding: '4px 8px', 
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  {showSteps ? 'Hide' : 'Show'} Steps
                </button>
              </div>
              
              {showSteps && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {steps.length > 0 ? (
                    steps.map((step: any, idx: number) => (
                      <div 
                        key={step.id || idx} 
                        style={{ 
                          padding: 8, 
                          background: step.status === 'completed' ? '#d4edda' : 'white', 
                          border: `1px solid ${step.status === 'completed' ? '#28a745' : '#ddd'}`,
                          borderRadius: 4,
                          display: 'flex',
                          gap: 8,
                          alignItems: 'start'
                        }}
                      >
                        <div style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: '50%', 
                          background: step.status === 'completed' ? '#28a745' : '#6c757d',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 600,
                          flexShrink: 0
                        }}>
                          {step.status === 'completed' ? '✓' : step.step_number || (idx + 1)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{step.title || `Step ${idx + 1}`}</div>
                          <div style={{ fontSize: 13, color: '#666' }}>{step.description || 'Complete this step'}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>
                      Steps will be generated when you start the mission...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'column' }}>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button 
                  onClick={handleStart} 
                  disabled={loading || !!busy || done || isActive || disabled} 
                  aria-busy={busy==='start'} 
                  aria-label={t('start')}
                  title={disabled && !isActive ? (t('missions.completeCurrentFirst') || 'Complete your current mission first') : undefined}
                  style={disabled && !isActive ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {busy==='start' ? (t('starting') || 'Starting...') : 
                   isActive ? (t('active') || 'Active') : 
                   disabled ? (t('missions.completeCurrentFirst') || 'Complete current first') :
                   (t('start') || 'Start')}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" style={{ background: 'var(--qic-primary)', color: 'white', padding: '4px 8px', borderRadius: 6 }}>
                {t('tooltip.beginMission') || 'Begin this mission'}
              </Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button 
                  style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} 
                  onClick={handleComplete} 
                  disabled={loading || !!busy || done || !isActive} 
                  aria-busy={busy==='complete'} 
                  aria-label={t('complete')}
                >
                  {done ? '✔️ ' + (t('done') || 'Done') : (busy==='complete' ? (t('completing') || 'Completing…') : t('complete'))}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" style={{ background: 'var(--qic-primary)', color: 'white', padding: '4px 8px', borderRadius: 6 }}>
                {t('tooltip.markComplete') || 'Mark mission as complete'}
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
          {mission.ai_rationale ? (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button aria-label={t('ai.rationale') || 'AI rationale'} style={{ fontSize: 12, background: 'transparent', border: '1px solid var(--qic-border)', padding: '4px 6px', borderRadius: 6 }}>
                  {t('ai.rationale') || 'AI rationale'}
                </button>
              </Popover.Trigger>
              <Popover.Content side="left" style={{ background: 'white', border: '1px solid var(--qic-border)', borderRadius: 8, padding: 10, maxWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <div style={{ fontSize: 12 }}>{mission.ai_rationale}</div>
              </Popover.Content>
            </Popover.Root>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
