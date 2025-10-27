import React, { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '@/lib/api';
import BottomNav from '@/components/BottomNav';
import i18n, { setDirection } from '@/lib/i18n';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getProfile()
      .then((d) => setProfile(d?.data || d))
      .catch((e) => setError(e?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      await updateProfile({ nickname: profile?.nickname || 'hero' });
      alert('Saved');
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    }
  };

  return (
    <div style={{ paddingBottom: 64 }}>
      <h2>Profile</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <pre style={{ background: '#111418', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(profile, null, 2)}
      </pre>
      <button onClick={save}>Save</button>
      <div className="qic-card" style={{ padding: 12, marginTop: 12 }}>
        <label>
          Language
          <select value={i18n.language} onChange={(e)=>{ const lng = e.target.value; localStorage.setItem('lng', lng); i18n.changeLanguage(lng); setDirection(lng); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>
      <BottomNav />
    </div>
  );
}


