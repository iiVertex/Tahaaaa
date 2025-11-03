import React, { useEffect, useState } from 'react';
import { getAchievements, getUserAchievements, getMissions } from '@/lib/api';
import { IslamicStarPattern, DatePalmIcon } from '@/components/QatarAssets';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { useQuery } from '@tanstack/react-query';
import { track } from '@/lib/analytics';

export default function Achievements() {
  const { t } = useTranslation();
  const [all, setAll] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch completed missions
  const { data: missionsResponse } = useQuery({
    queryKey: ['missions'],
    queryFn: getMissions,
    refetchInterval: 5000, // Auto-refetch every 5 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Extract completed missions from missions response
  const completedMissions = React.useMemo(() => {
    let allMissions = [];
    if (Array.isArray(missionsResponse)) {
      allMissions = missionsResponse;
    } else if (Array.isArray(missionsResponse?.data?.missions)) {
      allMissions = missionsResponse.data.missions;
    } else if (Array.isArray(missionsResponse?.missions)) {
      allMissions = missionsResponse.missions;
    }
    
    // Filter for completed missions only
    return allMissions.filter((m: any) => {
      const status = m.user_progress?.status;
      return status === 'completed' || status === 'Completed';
    });
  }, [missionsResponse]);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      getAchievements().catch(()=>{ setError(t('errors.loadAchievements')); return []; }),
      getUserAchievements().catch(()=>[])
    ])
      .then(([a, u]) => { setAll(a || []); setMine(u || []); })
      .finally(() => setLoading(false));
  }, [t]);

  const earnedIds = new Set(mine.map((m:any)=> m.id || m.achievement_id));

  return (
    <MajlisLayout titleKey="achievements.title" icon={<IslamicStarPattern size={18} color="var(--qic-secondary)" />}>
      {/* Welcome Description */}
      <div className="qic-card-majlis" style={{ 
        padding: 20, 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 193, 7, 0.15) 100%)',
        border: '2px solid #FFD700',
        borderRadius: 12
      }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
          <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>🏆 Celebrate Your Journey</strong>
          <p style={{ margin: '12px 0 0 0' }}>
            Every step forward deserves recognition. Here's where your dedication shines—view all the missions you've conquered, 
            the badges you've earned, and the milestones you've achieved. Your accomplishments tell a story of growth, protection, and smart choices. 
            Share your wins and inspire others to build their own path to financial security!
          </p>
        </div>
      </div>
      
      {loading && <div className="qic-card-majlis" style={{ padding: 12 }}>{t('loading')}</div>}
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
      
      {/* Completed Missions Section */}
      {completedMissions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
            {t('achievements.completedMissions') || 'Completed Missions'}
          </h3>
          <div className="grid-rewards" style={{ display: 'grid', gap: 12 }}>
            {completedMissions.map((mission: any) => {
              const coinsEarned = mission.user_progress?.coins_earned || mission.coin_reward || 0;
              const xpEarned = mission.user_progress?.xp_earned || mission.xp_reward || 0;
              const lifescoreChange = mission.user_progress?.lifescore_change || mission.lifescore_impact || 0;
              const completedAt = mission.user_progress?.completed_at 
                ? new Date(mission.user_progress.completed_at).toLocaleDateString() 
                : '';
              
              return (
                <div key={mission.id} className="qic-card-majlis" style={{ padding: 16, border: '2px solid var(--qic-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                        {mission.title_en || mission.title || 'Completed Mission'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginBottom: 4 }}>
                        {mission.category || 'Mission'} · {mission.difficulty || 'Normal'}
                      </div>
                      {completedAt && (
                        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                          Completed on {completedAt}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          const missionName = mission.title_en || mission.title || 'a mission';
                          const coins = coinsEarned;
                          const subject = encodeURIComponent('I just completed a mission in QIC Life!');
                          const body = encodeURIComponent(
                            `I completed "${missionName}" and earned ${coins} coins! 🎉\n\n` +
                            `Check out the QIC Life app to start your insurance journey and earn rewards!\n\n` +
                            `Stay protected, stay rewarded.`
                          );
                          const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
                          window.open(mailtoLink, '_blank');
                          // Track share event
                          track('mission_shared', {
                            mission_id: mission.id,
                            mission_name: missionName,
                            coins_earned: coins
                          });
                        }}
                        style={{
                          background: 'var(--qic-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📤 Share
                      </button>
                      <div style={{ background: '#28a745', color: 'white', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        ✓ Done
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #eee' }}>
                    {coinsEarned > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--qic-accent)' }}>+{coinsEarned}</span> {t('rewards.coins') || 'coins'}
                      </div>
                    )}
                    {xpEarned > 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--qic-secondary)' }}>+{xpEarned}</span> XP
                      </div>
                    )}
                    {lifescoreChange !== 0 && (
                      <div style={{ fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: lifescoreChange > 0 ? '#28a745' : '#dc3545' }}>
                          {lifescoreChange > 0 ? '+' : ''}{lifescoreChange}
                        </span> LifeScore
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Achievement Badges Section */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: 'var(--qic-primary)' }}>
          {t('achievements.badges') || 'Achievement Badges'}
        </h3>
        <div className="grid-rewards" style={{ marginTop: 8 }}>
          {all.map((a) => {
            const earned = earnedIds.has(a.id);
            return (
              <div key={a.id} className="qic-card-majlis" style={{ padding: 12, opacity: earned ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title_en || a.name_en || a.title || a.name_ar || a.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{earned ? t('achievements.earned') : t('achievements.locked')}</div>
                  </div>
                  <div style={{ background: 'var(--qic-accent)', color: '#111', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{(a.coins ?? a.coin_reward ?? 0)} {t('rewards.coins')}</div>
                </div>
              </div>
            );
          })}
          {!loading && all.length === 0 && completedMissions.length === 0 && (
            <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DatePalmIcon size={18} color="var(--qic-secondary)" />
              <div>{t('achievements.empty')}</div>
            </div>
          )}
        </div>
      </div>
    </MajlisLayout>
  );
}