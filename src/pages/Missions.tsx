import React, { useEffect, useState } from 'react';
import { getMissions, startMission, completeMission } from '@/lib/api';
import MissionCard from '@/components/MissionCard';
import { CardSkeleton } from '@/components/Skeletons';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Missions() {
  const { t } = useTranslation();
  const toast = useToast();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMissions()
      .then((list) => setMissions(list || []))
      .catch(() => setError(t('errors.loadMissions')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <MajlisLayout titleKey="missions.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m}
            onStart={(id)=>startMission(id).then(()=>toast.success(t('toast.missionStarted'), m.title_en || m.title || id)).catch((e)=>toast.error(t('toast.errorStart'), e?.message))}
            onComplete={(id)=>completeMission(id).then(()=>toast.success(t('toast.missionCompleted'), `+${m.xp_reward ?? 10} XP`)).catch((e)=>toast.error(t('toast.errorComplete'), e?.message))}
          />
        ))}
      </div>
      {!loading && !error && missions.length === 0 && (
        <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatePalmIcon size={18} color="var(--qic-secondary)" />
          <div>{t('missions.empty')}</div>
        </div>
      )}
    </MajlisLayout>
  );
}


