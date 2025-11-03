import React from 'react';
import { getMissions, startMission, completeMission, generateMissions, getDailyBrief, generateDailyMissions } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import ChallengeView from '@/components/ChallengeView';
import { CardSkeleton } from '@/components/Skeletons';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile } from '@/lib/api';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useCoins } from '@/lib/coins';
import { useSearchParams } from 'react-router-dom';

export default function Missions() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { refreshCoins } = useCoins();
  const [generating, setGenerating] = React.useState(false);
  const [generatingDaily, setGeneratingDaily] = React.useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const startedMissionId = searchParams.get('started'); // Mission ID from URL param when redirected from Showcase
  const [expandedMissionId] = React.useState<string | null>(startedMissionId || null);
  const [selectedMission, setSelectedMission] = React.useState<any>(null); // Mission selected for ChallengeView
  const [isChallengeViewOpen, setIsChallengeViewOpen] = React.useState(false);

  // Check if Clerk is available
  const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!CLERK_PUBLISHABLE_KEY;

  // Track last sync time for status indicator
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const { data: missionsResponse, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['missions'],
    queryFn: getMissions,
    refetchInterval: 5000, // Auto-refetch every 5 seconds for real-time sync
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
  
  // Handle different response formats and extract missions array
  // CRITICAL: Filter out completed missions (they should appear in Achievements, not here)
  const missions = React.useMemo(() => {
    let allMissions = [];
    if (Array.isArray(missionsResponse)) {
      allMissions = missionsResponse;
    } else if (Array.isArray(missionsResponse?.data?.missions)) {
      allMissions = missionsResponse.data.missions;
    } else if (Array.isArray(missionsResponse?.missions)) {
      allMissions = missionsResponse.missions;
    }
    
    // Filter out completed missions - they should not appear in active mission list
    return allMissions.filter((m: any) => {
      const status = m.user_progress?.status;
      return status !== 'completed' && status !== 'Completed';
    });
  }, [missionsResponse]);

  // Update last sync time when missions data updates
  React.useEffect(() => {
    if (dataUpdatedAt) {
      setLastSyncTime(new Date(dataUpdatedAt));
      setIsSyncing(false);
    }
  }, [dataUpdatedAt]);

  const { data: profile, dataUpdatedAt: profileUpdatedAt } = useQuery({ 
    queryKey: ['profile'], 
    queryFn: getProfile 
  });

  // Auto-refetch missions when profile changes
  React.useEffect(() => {
    if (profileUpdatedAt) {
      setIsSyncing(true);
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.refetchQueries({ queryKey: ['missions'] }).finally(() => setIsSyncing(false));
    }
  }, [profileUpdatedAt, qc]);
  const profileJson = (profile as any)?.userProfile?.profile_json || {};
  const prefs = profileJson.preferences || {};
  const userName = profileJson.name || '';
  
  // Get user's difficulty preference for coin rewards (easy=10, medium=20, hard=30)
  const userDifficultyPref = prefs?.missionDifficulty || 'easy';
  const coinRewardByDifficulty = userDifficultyPref === 'easy' ? 10 : userDifficultyPref === 'medium' ? 20 : 30;
  
  // Load suggested missions from AI Showcase (stored in localStorage)
  const [aiSuggestedMissions, setAiSuggestedMissions] = React.useState<any[]>([]);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('qic_ai_suggested_missions');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only show if generated within last 24 hours
        const generatedAt = new Date(parsed.generatedAt);
        const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24 && parsed.missions && Array.isArray(parsed.missions)) {
          setAiSuggestedMissions(parsed.missions);
        } else {
          localStorage.removeItem('qic_ai_suggested_missions');
        }
      }
    } catch (e) {
      console.warn('Failed to load suggested missions:', e);
    }
  }, []);
  
  // Clear URL param after reading it
  React.useEffect(() => {
    if (startedMissionId) {
      setSearchParams({}, { replace: true });
    }
  }, [startedMissionId, setSearchParams]);
  
  // Check profile completion - MUST be defined before queries that use it
  // Profile is complete if: name, age, gender, nationality, and at least one insurance_preference exist
  const isProfileComplete = React.useMemo(() => {
    // Check if profileJson exists and is not empty
    if (!profileJson || typeof profileJson !== 'object' || Object.keys(profileJson).length === 0) {
      if (import.meta.env.DEV) {
        console.log('[Missions] Profile completion: profileJson is empty or invalid');
      }
      return false;
    }
    
    // Check required fields (name, age, gender, nationality)
    const hasName = !!profileJson.name && String(profileJson.name).trim().length > 0;
    const hasAge = typeof profileJson.age === 'number' && profileJson.age > 0;
    const hasGender = !!profileJson.gender && String(profileJson.gender).trim().length > 0;
    const hasNationality = !!profileJson.nationality && String(profileJson.nationality).trim().length > 0;
    
    // Check insurance_preferences (must be array with at least one item)
    const hasInsurancePrefs = Array.isArray(profileJson.insurance_preferences) && profileJson.insurance_preferences.length > 0;
    
    const isComplete = hasName && hasAge && hasGender && hasNationality && hasInsurancePrefs;
    
    // Always log in dev mode for debugging
    if (import.meta.env.DEV) {
      console.log('[Missions] Profile completion check:', {
        isComplete,
        hasName, hasAge, hasGender, hasNationality, hasInsurancePrefs,
        name: profileJson.name,
        age: profileJson.age,
        gender: profileJson.gender,
        nationality: profileJson.nationality,
        insurance_preferences: profileJson.insurance_preferences,
        insurancePrefsType: Array.isArray(profileJson.insurance_preferences) ? 'array' : typeof profileJson.insurance_preferences,
        insurancePrefsLength: Array.isArray(profileJson.insurance_preferences) ? profileJson.insurance_preferences.length : 'N/A'
      });
    }
    
    return isComplete;
  }, [profileJson]);

  // Daily brief query - uses isProfileComplete (now defined above)
  const { data: dailyBrief } = useQuery({
    queryKey: ['dailyBrief'],
    queryFn: getDailyBrief,
    refetchInterval: 60 * 60 * 1000, // Refetch every hour
    enabled: isProfileComplete, // Only fetch if profile is complete
    staleTime: 30 * 60 * 1000, // Consider fresh for 30 minutes
  });

  // Daily missions query
  const { data: dailyMissionsData, refetch: refetchDailyMissions } = useQuery({
    queryKey: ['dailyMissions'],
    queryFn: generateDailyMissions,
    enabled: false, // Only fetch on demand (when user clicks refresh)
    staleTime: 24 * 60 * 60 * 1000, // Consider fresh for 24 hours
  });
  // Filter out completed daily missions - they should appear in Achievements, not here
  const dailyMissions = React.useMemo(() => {
    const allDaily = (dailyMissionsData as any)?.missions || [];
    return allDaily.filter((m: any) => {
      const status = m.user_progress?.status;
      return status !== 'completed';
    });
  }, [dailyMissionsData]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result: any = await generateMissions();
      // Backend returns: { success: true, data: { missions: [...] } } or direct { missions: [...] }
      const generated = result?.missions || result?.data?.missions || [];
      if (generated.length > 0) {
        toast.success(t('missions.generated') || `Generated ${generated.length} personalized missions!`);
        await refreshCoins(); // Refresh coins after deduction
        // Invalidate and refetch to show newly generated missions
        await qc.invalidateQueries({ queryKey: ['missions'] });
        await qc.refetchQueries({ queryKey: ['missions'] });
      } else {
        const errorMsg = result?.message || 'No missions generated';
        // Check for credit/disabled errors
        if (errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API') || result?.disabled) {
          toast.warning('AI Service Unavailable', 'AI features temporarily unavailable. Coins were not deducted.');
          return;
        }
        if (errorMsg.includes('Profile incomplete') || errorMsg.includes('complete your profile')) {
          toast.error(t('missions.profileIncomplete') || errorMsg);
        } else {
          toast.error(t('missions.generateFailed') || errorMsg);
        }
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Failed to generate missions';
      if (errorMsg.includes('Profile incomplete') || errorMsg.includes('complete your profile')) {
        toast.error(t('missions.profileIncomplete') || errorMsg);
      } else {
        toast.error(t('missions.generateFailed') || errorMsg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRefreshDailyMissions = async () => {
    try {
      setGeneratingDaily(true);
      await refetchDailyMissions();
      toast.success(t('missions.dailyRefreshed') || 'Daily missions refreshed!');
      // Invalidate missions to include daily ones in the main list
      await qc.invalidateQueries({ queryKey: ['missions'] });
      await qc.refetchQueries({ queryKey: ['missions'] });
    } catch (e: any) {
      toast.error(t('missions.dailyRefreshFailed') || 'Failed to refresh daily missions', e?.message);
    } finally {
      setGeneratingDaily(false);
    }
  };

  // Check if user has any active mission (only 1 allowed at a time)
  const hasActiveMission = React.useMemo(() => {
    if (!missions || !Array.isArray(missions)) return false;
    return missions.some((m: any) => {
      const status = m.user_progress?.status;
      return status === 'active' || status === 'started';
    });
  }, [missions]);

  const missionsSorted = React.useMemo(() => {
    if (!missions || !Array.isArray(missions) || missions.length === 0) return [];
    const insurancePrefs = Array.isArray(profileJson.insurance_preferences) ? profileJson.insurance_preferences : [];
    const areasOfInterest = Array.isArray(profileJson.areas_of_interest) ? profileJson.areas_of_interest : [];
    const allInterests = [...insurancePrefs, ...areasOfInterest];
    const diffPref = (prefs?.missionDifficulty || '').toLowerCase();
    return [...missions].map((m:any)=>{
      if (!m || !m.id) return null;
      let score = 0;
      const category = (m.category||'').toLowerCase();
      if (allInterests.some(int => int.toLowerCase() === category)) score += 2;
      if (diffPref && (m.difficulty||'').toLowerCase() === diffPref) score += 1;
      if (m.ai_generated) score += 1; // Prioritize AI-generated missions
      return { m, score };
    }).filter((x:any) => x !== null).sort((a:any,b:any)=> b.score - a.score).map((x:any)=> x.m);
  }, [missions, prefs, profileJson]);

  return (
    <MajlisLayout titleKey="missions.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {userName && (
        <div style={{ marginBottom: 12, fontSize: 16, color: 'var(--qic-primary)', fontWeight: 500 }}>
          Hi {userName}! Ready to tackle today's missions? 🎯
        </div>
      )}
      
      {/* Daily Brief Banner - Only show if profile is complete */}
      {isProfileComplete && dailyBrief && (
        <div className="qic-card" style={{ padding: 16, marginBottom: 16, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', borderRadius: 12, border: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🦅</span>
            <span>{dailyBrief}</span>
          </div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            {t('missions.dailyBriefHint') || 'Complete today\'s adaptive missions to earn QIC Coins and unlock rewards!'}
          </div>
        </div>
      )}

      {/* Daily Adaptive Missions Section */}
      {isProfileComplete && (
        <div className="qic-card" style={{ padding: 16, marginBottom: 16, background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🌴 {t('missions.dailyMissions') || 'Daily Adaptive Missions'}</div>
              <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>
                {t('missions.dailyMissionsHint') || 'Complete 3 tiered missions (Easy/Medium/Hard) - reset daily at 8 AM'}
              </div>
            </div>
            <button
              onClick={handleRefreshDailyMissions}
              disabled={generatingDaily}
              style={{
                padding: '8px 16px',
                background: 'var(--qic-secondary)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                cursor: generatingDaily ? 'wait' : 'pointer',
                opacity: generatingDaily ? 0.7 : 1,
                fontSize: 14
              }}
            >
              {generatingDaily ? (t('generating') || 'Generating...') : (t('missions.refreshDaily') || 'Refresh Daily')}
            </button>
          </div>
          {dailyMissions.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {dailyMissions.slice(0, 3).map((m: any, idx: number) => {
                const isThisActive = m.user_progress?.status === 'active' || m.user_progress?.status === 'started';
                const shouldDisableStart = hasActiveMission && !isThisActive;
                return (
                  <MissionCard
                    key={m.id || `daily-${idx}`}
                    mission={{
                      ...m,
                      id: m.id || `daily-${idx}`,
                      title: m.title || m.title_en || `Daily Mission ${idx + 1}`,
                      title_en: m.title_en || m.title || `Daily Mission ${idx + 1}`,
                      description: m.description || m.description_en || 'Complete this daily mission',
                      description_en: m.description_en || m.description || 'Complete this daily mission',
                      coin_reward: m.coin_reward || (m.difficulty === 'easy' ? 50 : m.difficulty === 'medium' ? 150 : 300),
                      xp_reward: m.xp_reward || 100,
                      difficulty: m.difficulty || 'easy'
                    }}
                    disabled={shouldDisableStart}
                    userDifficultyPreference={userDifficultyPref}
                    onCardClick={(mission) => {
                      setSelectedMission(mission);
                      setIsChallengeViewOpen(true);
                    }}
                    onStart={async (id) => {
                      try {
                        const result: any = await startMission(id);
                        toast.success(t('toast.missionStarted') || 'Mission started', m.title_en || m.title || id);
                        const steps = result?.steps || result?.data?.steps || [];
                        if (steps.length > 0) {
                          toast.success(t('missions.stepsGenerated') || `Generated ${steps.length} steps!`);
                        }
                        await qc.invalidateQueries({ queryKey: ['missions'] });
                        await qc.refetchQueries({ queryKey: ['missions'] });
                        await refreshCoins();
                      } catch (e: any) {
                        const status = e?.response?.status;
                        const errorMsg = e?.response?.data?.message || e?.message || '';
                        if (status === 409 || errorMsg.includes('already have an active mission') || errorMsg.includes('already started') || errorMsg.includes('Complete it first')) {
                          // Mission already active - find and open it
                          const activeMission = missions.find((mission: any) => 
                            mission.id === id && (mission.user_progress?.status === 'active' || mission.user_progress?.status === 'started')
                          ) || missions.find((mission: any) => mission.id === id);
                          if (activeMission) {
                            setSelectedMission(activeMission);
                            setTimeout(() => setIsChallengeViewOpen(true), 100);
                          }
                        } else {
                          toast.error(t('toast.errorStart') || 'Failed to start mission', errorMsg);
                        }
                      }
                    }}
                    onComplete={async (id) => {
                      try {
                        const result: any = await completeMission(id);
                        const coinReward = result?.data?.coinsResult?.coinsGained || result?.data?.coins || (m.difficulty === 'easy' ? 50 : m.difficulty === 'medium' ? 150 : 300);
                        const xpReward = result?.data?.xpResult?.xpGained || result?.data?.xp || m.xp_reward || 100;
                        toast.success(t('toast.missionCompleted') || 'Mission completed!', `+${coinReward} coins, +${xpReward} XP`);
                        await qc.invalidateQueries({ queryKey: ['missions'] });
                        await qc.invalidateQueries({ queryKey: ['profile'] });
                        await qc.refetchQueries({ queryKey: ['missions'] });
                        await qc.refetchQueries({ queryKey: ['profile'] });
                        await refreshCoins();
                      } catch (e: any) {
                        toast.error(t('toast.errorComplete') || 'Failed to complete mission', e?.message);
                      }
                    }}
                    loading={generatingDaily}
                    aiPick={
                      Array.isArray(profileJson.insurance_preferences) && 
                      profileJson.insurance_preferences.some((pref: string) => 
                        (m.category||'').toLowerCase() === pref.toLowerCase()
                      )
                    }
                  />
                );
              })}
            </div>
          )}
          {dailyMissions.length === 0 && !generatingDaily && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--qic-muted)', fontSize: 14 }}>
              {t('missions.noDailyMissions') || 'Click "Refresh Daily" to generate today\'s adaptive missions'}
            </div>
          )}
        </div>
      )}

      {/* AI Recommended Missions from Showcase */}
      {aiSuggestedMissions.length > 0 && (
        <div className="qic-card" style={{ padding: 16, marginBottom: 16, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'white' }}>
                🌟 Recommended Missions (from AI Showcase)
              </div>
              <div style={{ fontSize: 12, opacity: 0.9, color: 'white' }}>
                AI-suggested missions based on your recent scenario analysis
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('qic_ai_suggested_missions');
                setAiSuggestedMissions([]);
              }}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Dismiss recommendations"
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {aiSuggestedMissions.map((m: any, idx: number) => (
              <MissionCard
                key={m.id || `ai-suggested-${idx}`}
                mission={{
                  ...m,
                  title: m.title || m.title_en,
                  title_en: m.title_en || m.title,
                  description: m.description || m.description_en,
                  description_en: m.description_en || m.description
                }}
                onCardClick={(mission) => {
                  setSelectedMission(mission);
                  setIsChallengeViewOpen(true);
                }}
                onStart={async (id) => {
                  try {
                    const result: any = await startMission(id);
                    toast.success(t('toast.missionStarted') || 'Mission started', m.title || m.title_en || id);
                    const steps = result?.steps || result?.data?.steps || [];
                    if (steps.length > 0) {
                      toast.success(t('missions.stepsGenerated') || `Generated ${steps.length} steps!`);
                    }
                    const startedMission = aiSuggestedMissions.find((mission: any) => mission.id === id);
                    if (startedMission) {
                      setSelectedMission(startedMission);
                      setTimeout(() => setIsChallengeViewOpen(true), 100);
                    }
                    await qc.invalidateQueries({ queryKey: ['missions'] });
                    await qc.refetchQueries({ queryKey: ['missions'] });
                    await refreshCoins();
                  } catch (e: any) {
                    const status = e?.response?.status;
                    const errorMsg = e?.response?.data?.message || e?.message || '';
                    // Check for insufficient coins error
                    if (errorMsg.includes('Insufficient coins') || errorMsg.includes('required')) {
                      toast.error(t('errors.insufficientCoins') || 'Insufficient coins', errorMsg);
                    } else if (status === 409 || errorMsg.includes('already have an active mission') || errorMsg.includes('already started') || errorMsg.includes('Complete it first')) {
                      // Mission already active - find and open it
                      const activeMission = aiSuggestedMissions.find((mission: any) => 
                        mission.id === id && (mission.user_progress?.status === 'active' || mission.user_progress?.status === 'started')
                      ) || aiSuggestedMissions.find((mission: any) => mission.id === id);
                      if (activeMission) {
                        setSelectedMission(activeMission);
                        setTimeout(() => setIsChallengeViewOpen(true), 100);
                      }
                    } else if (errorMsg.includes('credits exceeded') || errorMsg.includes('DISABLE_AI_API')) {
                      toast.warning('AI Service Unavailable', 'AI features temporarily unavailable. Coins were not deducted.');
                    } else {
                      toast.error(t('toast.errorStart') || 'Failed to start mission', errorMsg);
                    }
                  }
                }}
                onComplete={async (id) => {
                  try {
                    const result: any = await completeMission(id);
                    const coinReward = result?.data?.coinsResult?.coinsGained || result?.data?.coins || coinRewardByDifficulty;
                    const xpReward = result?.data?.xpResult?.xpGained || result?.data?.xp || (m.xp_reward ?? 10);
                    toast.success(t('toast.missionCompleted') || 'Mission completed!', `+${coinReward} coins, +${xpReward} XP`);
                    await qc.invalidateQueries({ queryKey: ['missions'] });
                    await qc.invalidateQueries({ queryKey: ['profile'] });
                    await qc.refetchQueries({ queryKey: ['missions'] });
                    await qc.refetchQueries({ queryKey: ['profile'] });
                    await refreshCoins();
                    // Remove completed mission from localStorage
                    const stored = localStorage.getItem('qic_ai_suggested_missions');
                    if (stored) {
                      try {
                        const parsed = JSON.parse(stored);
                        const updatedMissions = parsed.missions?.filter((mission: any) => mission.id !== id) || [];
                        if (updatedMissions.length > 0) {
                          localStorage.setItem('qic_ai_suggested_missions', JSON.stringify({
                            generatedAt: parsed.generatedAt,
                            missions: updatedMissions
                          }));
                        } else {
                          localStorage.removeItem('qic_ai_suggested_missions');
                        }
                        setAiSuggestedMissions(updatedMissions);
                      } catch (e) {
                        console.warn('Failed to update suggested missions:', e);
                      }
                    }
                  } catch (e: any) {
                    toast.error(t('toast.errorComplete') || 'Failed to complete mission', e?.message);
                  }
                }}
                disabled={hasActiveMission && !missions.some((existing: any) => existing.id === m.id && (existing.user_progress?.status === 'active' || existing.user_progress?.status === 'started'))}
              />
            ))}
          </div>
        </div>
      )}

      {hasClerk && (
        <SignedOut>
          <div className="qic-card" style={{ padding: 16, marginBottom: 16, background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1565c0' }}>🔐 Sign In Required</div>
            <div style={{ fontSize: 14, marginBottom: 12, color: '#1565c0' }}>
              {t('auth.signInToPersist') || 'Sign in to save your progress and get personalized missions tailored to your profile'}
            </div>
          </div>
        </SignedOut>
      )}

      {(hasClerk ? (
        <SignedIn>
          <>
        {/* Profile completion banner removed - missions can be started regardless of profile completion status */}

        {isProfileComplete && (
          <div style={{ marginBottom: 12 }}>
            <button 
              onClick={handleGenerate} 
              disabled={generating}
              style={{ 
                padding: '10px 16px', 
                background: 'var(--qic-secondary)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 8,
                fontWeight: 600,
                cursor: generating ? 'wait' : 'pointer',
                opacity: generating ? 0.7 : 1
              }}
            >
              {generating ? (t('generating') || 'Generating...') : (t('missions.generate') || 'Generate Personalized Missions')}
            </button>
            <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginTop: 4 }}>
              Click to generate AI-powered missions tailored to your profile
            </div>
          </div>
        )}

        {/* Sync Status Indicator */}
        <div className="qic-card" style={{ padding: 8, marginBottom: 12, background: '#f5f5f5', border: '1px solid #e0e0e0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSyncing ? (
            <>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--qic-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span>Syncing missions...</span>
            </>
          ) : lastSyncTime ? (
            <>
              <span style={{ color: '#4caf50' }}>✓</span>
              <span>Last synced: {Math.floor((Date.now() - lastSyncTime.getTime()) / 1000)}s ago</span>
            </>
          ) : (
            <>
              <span style={{ color: '#757575' }}>○</span>
              <span>Missions synced</span>
            </>
          )}
          {hasActiveMission && (
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--qic-secondary)' }}>
              {missions.filter((m: any) => (m.user_progress?.status === 'active' || m.user_progress?.status === 'started')).length} Active
            </span>
          )}
        </div>

        {hasActiveMission && (
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#e3f2fd', border: '1px solid #2196f3' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>ℹ️ Active Mission</div>
            <div style={{ fontSize: 14 }}>
              {t('missions.oneAtATime') || 'You can only have one active mission at a time. Complete your current mission before starting a new one.'}
            </div>
          </div>
        )}


        {isLoading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
        {isError && <p style={{ color: 'salmon' }}>{t('errors.loadMissions')}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
          {missionsSorted.map((m: any) => {
            const isThisActive = m.user_progress?.status === 'active' || m.user_progress?.status === 'started';
            // Only disable if user has another active mission (one at a time restriction)
            const shouldDisableStart = hasActiveMission && !isThisActive;
            // Auto-expand steps for mission that was just started (from Showcase redirect)
            const shouldAutoExpand = expandedMissionId === m.id && isThisActive;
            return (
          <MissionCard key={m.id} mission={m}
              disabled={shouldDisableStart}
              userDifficultyPreference={userDifficultyPref}
              autoExpandSteps={shouldAutoExpand}
              onCardClick={(mission) => {
                setSelectedMission(mission);
                setIsChallengeViewOpen(true);
              }}
            onStart={async (id)=>{
              try { 
                const result: any = await startMission(id); 
                toast.success(t('toast.missionStarted') || 'Mission started', m.title_en || m.title || id); 
                // Backend returns: { success: true, data: { steps: [...] } } or direct { steps: [...] }
                const steps = result?.steps || result?.data?.steps || [];
                if (steps.length > 0) {
                  toast.success(t('missions.stepsGenerated') || `Generated ${steps.length} steps!`);
                }
                // CRITICAL: Immediately open ChallengeView for the started mission
                const startedMission = missions.find((mission: any) => mission.id === id);
                if (startedMission) {
                  setSelectedMission(startedMission);
                  // Use setTimeout to ensure state updates happen after async operations
                  setTimeout(() => {
                    setIsChallengeViewOpen(true);
                  }, 100);
                } else {
                  // Fallback: open with just the mission ID if not found in list
                  setSelectedMission({ id } as any);
                  setTimeout(() => {
                    setIsChallengeViewOpen(true);
                  }, 100);
                }
                // Invalidate and refetch to get updated user_progress
                await qc.invalidateQueries({ queryKey: ['missions'] });
                await qc.refetchQueries({ queryKey: ['missions'] });
                await refreshCoins(); // Refresh coins after starting
              } catch (e:any) {
                // Handle 409 Conflict - mission already started, just open it
                const status = e?.response?.status;
                const errorMsg = e?.response?.data?.message || e?.message || '';
                
                if (status === 409 || errorMsg.includes('already have an active mission') || errorMsg.includes('already started') || errorMsg.includes('Complete it first')) {
                  // Mission is already active - fetch and open it silently
                  const activeMission = missions.find((mission: any) => 
                    mission.id === id && (mission.user_progress?.status === 'active' || mission.user_progress?.status === 'started')
                  ) || missions.find((mission: any) => mission.id === id);
                  
                  if (activeMission) {
                    setSelectedMission(activeMission);
                    setTimeout(() => {
                      setIsChallengeViewOpen(true);
                    }, 100);
                    // Don't show error toast - mission is already active and we're opening it
                  } else {
                    // Mission not found in current list, try to open by ID
                    setSelectedMission({ id } as any);
                    setTimeout(() => {
                      setIsChallengeViewOpen(true);
                    }, 100);
                  }
                } else {
                  toast.error(t('toast.errorStart') || 'Failed to start mission', errorMsg);
                }
              }
            }}
            onComplete={async (id)=>{
              try { 
                const result: any = await completeMission(id); 
                // Use user's profile difficulty preference for coin rewards (easy=10, medium=20, hard=30)
                const coinReward = result?.data?.coinsResult?.coinsGained || result?.data?.coins || coinRewardByDifficulty;
                const xpReward = result?.data?.xpResult?.xpGained || result?.data?.xp || (m.xp_reward ?? 10);
                toast.success(t('toast.missionCompleted') || 'Mission completed!', `+${coinReward} coins, +${xpReward} XP`); 
                await qc.invalidateQueries({ queryKey: ['missions'] });
                await qc.invalidateQueries({ queryKey: ['profile'] });
                await qc.refetchQueries({ queryKey: ['missions'] });
                await qc.refetchQueries({ queryKey: ['profile'] }); // Refresh profile to get updated coins
                await refreshCoins(); // Refresh coins from backend
              } catch (e:any) { 
                toast.error(t('toast.errorComplete') || 'Failed to complete mission', e?.message); 
              }
            }}
            aiPick={
              Array.isArray(profileJson.insurance_preferences) && 
              profileJson.insurance_preferences.some((pref: string) => 
                (m.category||'').toLowerCase() === pref.toLowerCase()
              )
            }
          />
            );
          })}
      </div>
        {!isLoading && !isError && missionsSorted.length === 0 && (
          <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatePalmIcon size={18} color="var(--qic-secondary)" />
            <div>{t('missions.empty') || 'No missions available. Generate missions to get started!'}</div>
          </div>
        )}
          </>
        </SignedIn>
      ) : (
        <>
        {/* Show missions even when Clerk is not configured - profile completion banner removed */}

        {isProfileComplete && (
          <div style={{ marginBottom: 12 }}>
            <button 
              onClick={handleGenerate} 
              disabled={generating}
              style={{ 
                padding: '10px 16px', 
                background: 'var(--qic-secondary)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 8,
                fontWeight: 600,
                cursor: generating ? 'wait' : 'pointer',
                opacity: generating ? 0.7 : 1
              }}
            >
              {generating ? (t('missions.generating') || 'Generating...') : (t('missions.generate') || 'Generate Personalized Missions')}
            </button>
          </div>
        )}

        {hasActiveMission && (
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#e3f2fd', border: '1px solid #2196f3' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>ℹ️ Active Mission</div>
            <div style={{ fontSize: 14 }}>
              {t('missions.oneAtATime') || 'You can only have one active mission at a time. Complete your current mission before starting a new one.'}
            </div>
          </div>
        )}

        {isLoading && <div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}
        {isError && <div className="qic-card" style={{ padding: 12, color: 'salmon' }}>{t('errors.loadMissions') || 'Failed to load missions'}</div>}
        
        {!isLoading && !isError && missionsSorted.length === 0 && (
          <div className="qic-card" style={{ padding: 16, textAlign: 'center', color: 'var(--qic-muted)' }}>
            <div style={{ marginBottom: 12 }}><DatePalmIcon size={32} color="var(--qic-muted)" /></div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('missions.empty') || 'No missions available'}</div>
            <div style={{ fontSize: 14 }}>{t('missions.emptyHint') || 'Complete your profile and generate personalized missions to get started!'}</div>
        </div>
      )}

        <div style={{ display: 'grid', gap: 12 }}>
          {missionsSorted.map((m: any) => {
            const isThisActive = m.user_progress?.status === 'active' || m.user_progress?.status === 'started';
            const shouldDisableStart = hasActiveMission && !isThisActive;
            // Auto-expand steps for mission that was just started (from Showcase redirect)
            const shouldAutoExpand = expandedMissionId === m.id && isThisActive;
            return (
            <MissionCard key={m.id} mission={m}
              disabled={shouldDisableStart}
              userDifficultyPreference={userDifficultyPref}
              autoExpandSteps={shouldAutoExpand}
              onCardClick={(mission) => {
                setSelectedMission(mission);
                setIsChallengeViewOpen(true);
              }}
              onStart={async (id) => {
                try {
                  await startMission(id);
                  await qc.invalidateQueries({ queryKey: ['missions'] });
                  await qc.refetchQueries({ queryKey: ['missions'] });
                  await refreshCoins();
                  toast.success(t('missions.started') || 'Mission started!');
                } catch (e: any) {
                  const status = e?.response?.status;
                  const errorMsg = e?.response?.data?.message || e?.message || '';
                  if (status === 409 || errorMsg.includes('already have an active mission') || errorMsg.includes('already started') || errorMsg.includes('Complete it first')) {
                    // Mission already active - find and open it
                    const activeMission = missions.find((mission: any) => 
                      mission.id === id && (mission.user_progress?.status === 'active' || mission.user_progress?.status === 'started')
                    ) || missions.find((mission: any) => mission.id === id);
                    if (activeMission) {
                      setSelectedMission(activeMission);
                      setTimeout(() => setIsChallengeViewOpen(true), 100);
                    }
                  } else {
                    toast.error(t('errors.startMission', { message: errorMsg }) || 'Failed to start mission');
                  }
                }
              }}
              onComplete={async (id)=>{
                try {
                  const result: any = await completeMission(id);
                  // Use user's profile difficulty preference for coin rewards (easy=10, medium=20, hard=30)
                  const coinReward = result?.data?.coinsResult?.coinsGained || result?.data?.coins || coinRewardByDifficulty;
                  const xpReward = result?.data?.xpResult?.xpGained || result?.data?.xp || (m.xp_reward ?? 10);
                  toast.success(t('toast.missionCompleted') || 'Mission completed!', `+${coinReward} coins, +${xpReward} XP`);
                  await qc.invalidateQueries({ queryKey: ['missions'] });
                  await qc.invalidateQueries({ queryKey: ['profile'] });
                  await qc.refetchQueries({ queryKey: ['missions'] });
                  await qc.refetchQueries({ queryKey: ['profile'] });
                  await refreshCoins();
                } catch (e:any) {
                  toast.error(t('toast.errorComplete') || 'Failed to complete mission', e?.message);
                }
              }}
              loading={generating}
              aiPick={
                Array.isArray(profileJson.insurance_preferences) && 
                profileJson.insurance_preferences.some((pref: string) => 
                  (m.category||'').toLowerCase() === pref.toLowerCase()
                )
              }
            />
            );
          })}
    </div>
        </>
      ))}

      {/* ChallengeView Modal */}
      <ChallengeView
        mission={selectedMission}
        isOpen={isChallengeViewOpen}
        onClose={() => {
          setIsChallengeViewOpen(false);
          setSelectedMission(null);
        }}
        onComplete={async (missionId) => {
          try {
            const result: any = await completeMission(missionId);
            const coinReward = result?.data?.coinsResult?.coinsGained || result?.data?.coins || coinRewardByDifficulty;
            toast.success(t('toast.missionCompleted') || 'Mission completed!', `+${coinReward} coins`);
            await qc.invalidateQueries({ queryKey: ['missions'] });
            await qc.invalidateQueries({ queryKey: ['profile'] });
            await qc.refetchQueries({ queryKey: ['missions'] });
            await qc.refetchQueries({ queryKey: ['profile'] });
            await refreshCoins();
          } catch (e: any) {
            throw e; // Re-throw so ChallengeView can handle it
          }
        }}
        userName={profileJson?.name || ''}
      />
    </MajlisLayout>
  );
}