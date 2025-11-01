import React from 'react';
import { getMissions, startMission, completeMission, generateMissions, getDailyBrief, generateDailyMissions } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
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

  // Check if Clerk is available
  const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!CLERK_PUBLISHABLE_KEY;

  // Track last sync time for status indicator
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const { data: missions = [], isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['missions'],
    queryFn: getMissions,
    refetchInterval: 5000, // Auto-refetch every 5 seconds for real-time sync
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

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
  
  // Get user's difficulty preference for coin rewards (easy=10, medium=20, hard=30)
  const userDifficultyPref = prefs?.missionDifficulty || 'easy';
  const coinRewardByDifficulty = userDifficultyPref === 'easy' ? 10 : userDifficultyPref === 'medium' ? 20 : 30;
  
  // Clear URL param after reading it
  React.useEffect(() => {
    if (startedMissionId) {
      setSearchParams({}, { replace: true });
    }
  }, [startedMissionId, setSearchParams]);
  
  // Check profile completion - MUST be defined before queries that use it
  const isProfileComplete = React.useMemo(() => {
    const required = ['name', 'age', 'gender', 'nationality', 'insurance_preferences'];
    for (const field of required) {
      if (field === 'insurance_preferences') {
        if (!Array.isArray(profileJson[field]) || profileJson[field].length === 0) {
          return false;
        }
      } else if (!profileJson[field]) {
        return false;
      }
    }
    return true;
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
  const dailyMissions = (dailyMissionsData as any)?.missions || [];

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result: any = await generateMissions();
      // Backend returns: { success: true, data: { missions: [...] } } or direct { missions: [...] }
      const generated = result?.missions || result?.data?.missions || [];
      if (generated.length > 0) {
        toast.success(t('missions.generated') || `Generated ${generated.length} personalized missions!`);
        // Invalidate and refetch to show newly generated missions
        await qc.invalidateQueries({ queryKey: ['missions'] });
        await qc.refetchQueries({ queryKey: ['missions'] });
      } else {
        const errorMsg = result?.message || 'No missions generated';
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
                const badgeIcon = m.badge === 'falcon' ? '🦅' : m.badge === 'date_palm' ? '🌴' : m.badge === 'family' ? '👨‍👩‍👧‍👦' : '⭐';
                return (
                  <div key={m.id || `daily-${idx}`} className="qic-card" style={{ padding: 12, border: `2px solid ${m.difficulty === 'easy' ? '#4caf50' : m.difficulty === 'medium' ? '#ff9800' : '#f44336'}`, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{badgeIcon}</span>
                      <div style={{ fontWeight: 600 }}>{m.title_en || m.title || `Daily Mission ${idx + 1}`}</div>
                      <span style={{ 
                        fontSize: 10, 
                        padding: '2px 6px', 
                        background: m.difficulty === 'easy' ? '#4caf50' : m.difficulty === 'medium' ? '#ff9800' : '#f44336',
                        color: 'white',
                        borderRadius: 4,
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}>
                        {m.difficulty || 'easy'}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--qic-muted)', marginBottom: 8 }}>
                      {m.description_en || m.description || 'Complete this daily mission'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
                      <span>💰 {m.coin_reward || (m.difficulty === 'easy' ? 50 : m.difficulty === 'medium' ? 150 : 300)} Coins</span>
                      <span>⭐ {m.xp_reward || 100} XP</span>
                    </div>
                  </div>
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
        {!isProfileComplete && (
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Complete Your Profile First</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Complete your profile (Name, Age, Gender, Nationality, and at least one Insurance Preference) to generate personalized missions.
            </div>
            <button onClick={() => window.location.href = '/profile'} style={{ padding: '6px 12px', background: 'var(--qic-secondary)', color: 'white', border: 'none', borderRadius: 6 }}>
              Go to Profile
            </button>
          </div>
        )}

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
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
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
            const shouldDisableStart = hasActiveMission && !isThisActive; // Disable if another mission is active
            // Auto-expand steps for mission that was just started (from Showcase redirect)
            const shouldAutoExpand = expandedMissionId === m.id && isThisActive;
            return (
          <MissionCard key={m.id} mission={m}
              disabled={shouldDisableStart}
              userDifficultyPreference={userDifficultyPref}
              autoExpandSteps={shouldAutoExpand}
            onStart={async (id)=>{
              try { 
                const result: any = await startMission(id); 
                toast.success(t('toast.missionStarted') || 'Mission started', m.title_en || m.title || id); 
                // Backend returns: { success: true, data: { steps: [...] } } or direct { steps: [...] }
                const steps = result?.steps || result?.data?.steps || [];
                if (steps.length > 0) {
                  toast.success(t('missions.stepsGenerated') || `Generated ${steps.length} steps!`);
                }
                // Invalidate and refetch to get updated user_progress
                await qc.invalidateQueries({ queryKey: ['missions'] });
                await qc.refetchQueries({ queryKey: ['missions'] });
                await refreshCoins(); // Refresh coins after starting
              } catch (e:any) {
                const errorMsg = e?.message || '';
                if (errorMsg.includes('already have an active mission') || errorMsg.includes('Complete it first')) {
                  toast.error(t('errors.missionAlreadyActive') || 'You already have an active mission. Complete it first.', errorMsg);
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
        {/* Show missions even when Clerk is not configured */}
        {!isProfileComplete && (
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Complete Your Profile First</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Complete your profile (Name, Age, Gender, Nationality, and at least one Insurance Preference) to generate personalized missions.
            </div>
            <button onClick={() => window.location.href = '/profile'} style={{ padding: '6px 12px', background: 'var(--qic-secondary)', color: 'white', border: 'none', borderRadius: 6 }}>
              Go to Profile
            </button>
          </div>
        )}

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
          <div className="qic-card" style={{ padding: 12, marginBottom: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
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
              onStart={async (id) => {
                try {
                  await startMission(id);
                  await qc.invalidateQueries({ queryKey: ['missions'] });
                  await qc.refetchQueries({ queryKey: ['missions'] });
                  await refreshCoins();
                  toast.success(t('missions.started') || 'Mission started!');
                } catch (e: any) {
                  toast.error(t('errors.startMission', { message: e?.message || '' }) || 'Failed to start mission');
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
    </MajlisLayout>
  );
}
