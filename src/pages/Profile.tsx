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
  const [prefs, setPrefs] = useState<any>({
    notifications: { push: true, email: true, sms: false },
    missionDifficulty: 'easy',
    interests: ['health'],
    frequency: 'daily'
  });
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    getProfile()
      .then((d) => setProfile(d?.data || d))
      .catch(() => setError(t('errors.loadProfile')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    const raw = (profile as any) || {};
    const pjson = raw?.userProfile?.profile_json || {};
    const existing = pjson.preferences || {};
    setPrefs((prev: any) => ({
      notifications: { push: true, email: true, sms: false, ...(existing.notifications || {}) },
      missionDifficulty: existing.missionDifficulty || 'easy',
      interests: Array.isArray(existing.interests) ? existing.interests : ['health'],
      frequency: existing.frequency || 'daily'
    }));
  }, [profile]);

  const save = async () => {
    try {
      setSaving(true);
      const current = (profile as any)?.userProfile?.profile_json || {};
      const payload = { profile_json: { ...current, preferences: prefs }, nickname: profile?.nickname || 'hero' };
      await updateProfile(payload);
      toast.success(t('profile.saved'));
    } catch (e: any) {
      toast.error(t('profile.saveFailed'), e?.message);
    } finally { setSaving(false); }
  };

  return (
    <MajlisLayout titleKey="profile.title">
      {loading && <p>{t('loading')}</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <pre style={{ background: '#111418', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(profile, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={saving}>{saving ? (t('saving') || 'Saving…') : t('save')}</button>
        <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('profile.prefsHint') || 'Your preferences personalize missions and offers.'}</span>
      </div>
      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12 }}>
        <label>
          {t('language')}
          <select value={i18n.language} onChange={(e)=>{ const lng = e.target.value; localStorage.setItem('lng', lng); i18n.changeLanguage(lng); setDirection(lng); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>
      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Preferences</div>
        <label>
          Mission Difficulty
          <select value={prefs.missionDifficulty} onChange={(e)=> setPrefs((p:any)=> ({ ...p, missionDifficulty: e.target.value }))}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <div>
          Interests
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['health','safe_driving','finance'].map((k)=> (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={prefs.interests.includes(k)} onChange={()=>{
                  setPrefs((p:any)=> ({ ...p, interests: p.interests.includes(k) ? p.interests.filter((x:string)=>x!==k) : [...p.interests, k] }));
                }} /> {k.replace('_',' ')}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Select what you care about most to prioritize missions.</div>
        </div>
        <div>
          Engagement Frequency
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['daily','weekly'].map((k)=> (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="freq" checked={prefs.frequency===k} onChange={()=> setPrefs((p:any)=> ({ ...p, frequency: k }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>We’ll tailor reminder timing accordingly.</div>
        </div>
        <div>
          Notifications
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['push','email','sms'].map((k)=> (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!prefs.notifications[k]} onChange={()=> setPrefs((p:any)=> ({ ...p, notifications: { ...p.notifications, [k]: !p.notifications[k] } }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Choose how you prefer to be notified.</div>
        </div>
    </div>
    </MajlisLayout>
  );
}


