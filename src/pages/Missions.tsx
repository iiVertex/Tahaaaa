import React from 'react';
import { getMissions, startMission, completeMission } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import { CardSkeleton } from '@/components/Skeletons';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile } from '@/lib/api';

export default function Missions() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const { data: missions = [], isLoading, isError } = useQuery({
    queryKey: ['missions'],
    queryFn: getMissions,
  });

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const prefs = (profile as any)?.userProfile?.profile_json?.preferences || null;
  const missionsSorted = React.useMemo(() => {
    if (!missions || missions.length === 0) return missions;
    const interests: string[] = Array.isArray(prefs?.interests) ? prefs.interests : [];
    const diffPref = (prefs?.missionDifficulty || '').toLowerCase();
    return [...missions].map((m:any)=>{
      let score = 0;
      if (interests.includes((m.category||'').toLowerCase())) score += 2;
      if (diffPref && (m.difficulty||'').toLowerCase() === diffPref) score += 1;
      return { m, score };
    }).sort((a:any,b:any)=> b.score - a.score).map((x:any)=> x.m);
  }, [missions, prefs]);

  return (
    <MajlisLayout titleKey="missions.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {isLoading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {isError && <p style={{ color: 'salmon' }}>{t('errors.loadMissions')}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {missionsSorted.map((m: any) => (
          <MissionCard key={m.id} mission={m}
            onStart={async (id)=>{
              try { await startMission(id); toast.success(t('toast.missionStarted'), m.title_en || m.title || id); qc.invalidateQueries({ queryKey: ['missions'] }); } catch (e:any) { toast.error(t('toast.errorStart'), e?.message); }
            }}
            onComplete={async (id)=>{
              try { await completeMission(id); toast.success(t('toast.missionCompleted'), `+${m.xp_reward ?? 10} XP`); qc.invalidateQueries({ queryKey: ['missions'] }); } catch (e:any) { toast.error(t('toast.errorComplete'), e?.message); }
            }}
            aiPick={Array.isArray(prefs?.interests) && prefs.interests.includes((m.category||'').toLowerCase())}
          />
        ))}
      </div>
      {!isLoading && !isError && missions.length === 0 && (
        <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatePalmIcon size={18} color="var(--qic-secondary)" />
          <div>{t('missions.empty')}</div>
        </div>
      )}
    </MajlisLayout>
  );
}


