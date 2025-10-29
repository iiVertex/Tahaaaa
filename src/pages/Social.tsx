import React, { useEffect, useState } from 'react';
import { getSocialFeed } from '@/lib/api';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Social() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<{ friends: any[]; leaderboard: any[] }>({ friends: [], leaderboard: [] });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSocialFeed()
      .then((f) => setFeed(f || { friends: [], leaderboard: [] }))
      .catch(() => setError(t('errors.loadSocial')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <MajlisLayout titleKey="social.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {loading && <p>{t('loading')}</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div className="qic-card-majlis" style={{ padding: 12 }}>
        <pre style={{ margin: 0 }}>
          {JSON.stringify(feed, null, 2)}
        </pre>
      </div>
      {(!loading && !error && feed.friends.length === 0 && feed.leaderboard.length === 0) && (
        <div className="qic-card-majlis" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <DatePalmIcon size={18} color="var(--qic-secondary)" />
          <div>{t('social.empty')}</div>
        </div>
      )}
    </MajlisLayout>
  );
}


