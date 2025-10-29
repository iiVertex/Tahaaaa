import React, { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '@/lib/api';
import i18n, { setDirection } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';

export default function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getProfile()
      .then((d) => setProfile(d?.data || d))
      .catch(() => setError(t('errors.loadProfile')))
      .finally(() => setLoading(false));
  }, [t]);

  const save = async () => {
    try {
      await updateProfile({ nickname: profile?.nickname || 'hero' });
      toast.success(t('profile.saved'));
    } catch (e: any) {
      toast.error(t('profile.saveFailed'), e?.message);
    }
  };

  return (
    <MajlisLayout titleKey="profile.title">
      {loading && <p>{t('loading')}</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <pre style={{ background: '#111418', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(profile, null, 2)}
      </pre>
      <button onClick={save}>{t('save')}</button>
      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12 }}>
        <label>
          {t('language')}
          <select value={i18n.language} onChange={(e)=>{ const lng = e.target.value; localStorage.setItem('lng', lng); i18n.changeLanguage(lng); setDirection(lng); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>
    </MajlisLayout>
  );
}


