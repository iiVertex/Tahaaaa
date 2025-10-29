import React, { useEffect, useState } from 'react';
import { getAchievements, getUserAchievements } from '@/lib/api';
import { IslamicStarPattern, DatePalmIcon } from '@/components/QatarAssets';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Achievements() {
  const { t } = useTranslation();
  const [all, setAll] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      {loading && <div className="qic-card-majlis" style={{ padding: 12 }}>{t('loading')}</div>}
      {error && <div style={{ color: 'salmon' }}>{error}</div>}
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
        {!loading && all.length === 0 && (
          <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatePalmIcon size={18} color="var(--qic-secondary)" />
            <div>{t('achievements.empty')}</div>
          </div>
        )}
      </div>
    </MajlisLayout>
  );
}


