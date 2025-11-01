import React, { useEffect, useMemo, useState } from 'react';
import { getProfile, updateProfile } from '@/lib/api';
import i18n, { setDirection } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { useTranslation } from 'react-i18next';
import MajlisLayout from '@/components/MajlisLayout';
import { PlanType } from '@/data/insurancePlans';
import exclusiveOffers from '@/data/exclusiveOffers.json';
import { SignedOut, SignedIn } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';

// Helper to generate vulnerability suggestions based on demographics
function generateVulnerabilitySuggestions(age: number, gender: string): string[] {
  const suggestions: string[] = [];
  
  if (age >= 50) {
    suggestions.push('Health concerns', 'Family care responsibilities', 'Retirement planning');
    if (gender === 'female') {
      suggestions.push('Women\'s health coverage');
    }
  } else if (age >= 30) {
    suggestions.push('Family protection', 'Career stability', 'Property protection');
    if (gender === 'female') {
      suggestions.push('Maternity coverage');
    }
  } else if (age >= 18) {
    suggestions.push('Car insurance needs', 'Travel insurance', 'Gadget protection');
  }
  
  // Always add common ones
  suggestions.push('Frequent travel', 'Expensive electronics at home');
  
  return suggestions.slice(0, 6); // Limit to 6 suggestions
}

// Helper to filter offers based on user profile
function filterOffers(
  offers: typeof exclusiveOffers,
  insurancePreferences: string[],
  areasOfInterest: string[],
  firstTimeBuyer: boolean,
  mostNeededCategory?: string
): typeof exclusiveOffers {
  const relevant: typeof exclusiveOffers = [];
  const allCategories = [...insurancePreferences, ...areasOfInterest];
  
  for (const offer of offers) {
    const offerType = offer.offer_type;
    
    // Match by insurance preferences or areas of interest
    if (
      (offerType === 'car' && (allCategories.includes('car') || allCategories.includes('safe_driving'))) ||
      (offerType === 'fashion' && allCategories.includes('fashion')) ||
      (offerType === 'family' && allCategories.includes('family')) ||
      (offerType === 'food' && allCategories.includes('food')) ||
      (offerType === 'entertainment' && allCategories.includes('entertainment')) ||
      (offerType === 'electronics' && allCategories.includes('electronics'))
    ) {
      relevant.push(offer);
    }
    
    // Show first-time buyer offers for car category if they selected it
    if (firstTimeBuyer && offerType === 'car' && mostNeededCategory === 'car') {
      if (!relevant.find(o => o.title === offer.title)) {
        relevant.push(offer);
      }
    }
  }
  
  return relevant.slice(0, 5); // Limit to 5 most relevant
}

export default function Profile() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<any>({
    notifications: { push: true, email: true, sms: false },
    missionDifficulty: 'easy',
    interests: ['health'],
    frequency: 'daily'
  });
  const [insurancePreferences, setInsurancePreferences] = useState<string[]>([]);
  const [areasOfInterest, setAreasOfInterest] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<string>('');
  const [nationality, setNationality] = useState<string>('');
  const [budget, setBudget] = useState<number>(0);
  const [vulnerabilities, setVulnerabilities] = useState<string[]>([]);
  const [firstTimeBuyer, setFirstTimeBuyer] = useState<boolean>(false);
  const [suggestedVulnerabilities, setSuggestedVulnerabilities] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    getProfile()
      .then((d) => {
        // API returns: { userProfile: {...}, stats: {...} } or { data: { userProfile: {...}, stats: {...} } }
        const profileData = d?.data || d;
        setProfile(profileData);
      })
      .catch((e) => {
        console.error('Profile load error:', e);
        setError(t('errors.loadProfile'));
      })
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
    setName(pjson.name || '');
    setAge(typeof pjson.age === 'number' && pjson.age >= 18 && pjson.age <= 100 ? pjson.age : 25);
    setGender(pjson.gender || '');
    setNationality(pjson.nationality || '');
    setBudget(typeof pjson.budget === 'number' && pjson.budget >= 0 && pjson.budget <= 30000 ? pjson.budget : 0);
    setVulnerabilities(Array.isArray(pjson.vulnerabilities) ? pjson.vulnerabilities : []);
    setInsurancePreferences(Array.isArray(pjson.insurance_preferences) ? pjson.insurance_preferences : []);
    setAreasOfInterest(Array.isArray(pjson.areas_of_interest) ? pjson.areas_of_interest : []);
    setFirstTimeBuyer(!!pjson.first_time_buyer);
  }, [profile]);

  // Update suggested vulnerabilities when age or gender changes
  useEffect(() => {
    if (age && gender) {
      setSuggestedVulnerabilities(generateVulnerabilitySuggestions(age, gender));
    }
  }, [age, gender]);

  const save = async () => {
    try {
      setSaving(true);
      const current = (profile as any)?.userProfile?.profile_json || {};
      const payload = {
        profile_json: {
          ...current,
          preferences: {
            ...prefs,
            missionDifficulty: prefs.missionDifficulty || 'easy'
          }, // Keep old preferences for backward compatibility
          insurance_preferences: insurancePreferences, // New: separate insurance preferences
          areas_of_interest: areasOfInterest, // New: areas of interest
          name,
          age,
          gender,
          nationality,
          budget,
          vulnerabilities,
          first_time_buyer: firstTimeBuyer
        },
        nickname: profile?.nickname || 'hero'
      };
      
      // Ensure all required fields are included
      if (!payload.profile_json.name || !payload.profile_json.age || !payload.profile_json.gender || !payload.profile_json.nationality) {
        toast.error(t('profile.incomplete') || 'Please fill in all required fields');
        setSaving(false);
        return;
      }
      
      await updateProfile(payload);
      const savedTime = new Date();
      setLastSaved(savedTime);
      
      // Immediately invalidate and refetch profile and missions
      await qc.invalidateQueries({ queryKey: ['profile'] });
      await qc.refetchQueries({ queryKey: ['profile'] });
      await qc.invalidateQueries({ queryKey: ['missions'] });
      await qc.refetchQueries({ queryKey: ['missions'] });
      
      toast.success(t('profile.saved') || 'Profile saved successfully!');
    } catch (e: any) {
      toast.error(t('profile.saveFailed') || 'Failed to save profile', e?.message);
    } finally {
      setSaving(false);
    }
  };

  const mostNeeded: { type: PlanType; reason: string } | null = useMemo(() => {
    const ints: string[] = [...insurancePreferences, ...areasOfInterest];
    if (ints.includes('car') || ints.includes('safe_driving')) return { type: 'car', reason: 'Driving interest and safety focus' } as any;
    if (ints.includes('health') || ints.includes('medical')) return { type: 'medical', reason: 'Health-focused preferences' } as any;
    if (vulnerabilities.some(v => v.toLowerCase().includes('travel') || v.toLowerCase().includes('visa'))) return { type: 'travel', reason: 'Travel-related risks' } as any;
    if (budget > 0 && budget < 100) return { type: 'home', reason: 'Budget-conscious protection for essentials' } as any;
    return null;
  }, [insurancePreferences, areasOfInterest, vulnerabilities, budget]);

  const filteredOffers = useMemo(() => {
    return filterOffers(
      exclusiveOffers,
      insurancePreferences,
      areasOfInterest,
      firstTimeBuyer,
      mostNeeded?.type
    );
  }, [insurancePreferences, areasOfInterest, firstTimeBuyer, mostNeeded]);

  const isProfileComplete = useMemo(() => {
    return !!(
      name &&
      age >= 18 &&
      age <= 100 &&
      gender &&
      nationality &&
      insurancePreferences.length > 0
    );
  }, [name, age, gender, nationality, insurancePreferences]);

  // Check if Clerk is available
  const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const hasClerk = !!CLERK_PUBLISHABLE_KEY;

  return (
    <MajlisLayout titleKey="profile.title">
      {hasClerk && (
        <SignedOut>
          <div className="qic-card" style={{ padding: 16, marginBottom: 16, background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1565c0' }}>🔐 Sign In to Save Your Profile</div>
            <div style={{ fontSize: 14, color: '#1565c0' }}>
              {t('auth.signInToPersist') || 'Sign in to save your profile data and have it persist across sessions'}
            </div>
          </div>
        </SignedOut>
      )}
      
      {(hasClerk ? (
        <>
          <SignedIn>
            <>
      {loading && <p>{t('loading')}</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      
      {/* Profile Save Status Indicator */}
      {lastSaved && (
        <div className="qic-card" style={{ padding: 8, marginBottom: 12, background: '#e8f5e9', border: '1px solid #4caf50', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4caf50', fontSize: 16 }}>✓</span>
          <span>Profile saved at {lastSaved.toLocaleTimeString()}</span>
        </div>
      )}
      
      {!isProfileComplete && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Complete Your Profile</div>
          <div style={{ fontSize: 14 }}>
            Complete your profile to unlock mission generation. Required: Name, Age, Gender, Nationality, and at least one Insurance Preference.
          </div>
        </div>
      )}

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{t('profile.details') || 'Your Details'}</div>
        <label>
          {t('profile.name') || 'Name'}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.namePlaceholder') || 'Your name'} />
        </label>
        <label>
          Age
          <input
            type="range"
            min={18}
            max={100}
            step={1}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
          />
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{age} years old</div>
        </label>
        <label>
          Gender
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{t('profile.select') || 'Select'}</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label>
          {t('profile.nationality') || 'Nationality'}
          <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
            <option value="">{t('profile.select') || 'Select'}</option>
            <option value="Qatari">Qatari</option>
            <option value="Expat">Expat</option>
            <option value="Visitor">Visitor</option>
          </select>
        </label>
        <label>
          {t('profile.budget') || 'Yearly insurance budget (QAR)'}
          <input type="range" min={0} max={30000} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{budget.toLocaleString()} QAR/year (Max: 30,000)</div>
        </label>
        
        <div>
          <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
            {t('profile.vulnerabilities') || 'Vulnerabilities (help us tailor discounts)'}
          </label>
          {suggestedVulnerabilities.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {suggestedVulnerabilities.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (!vulnerabilities.includes(suggestion)) {
                      setVulnerabilities([...vulnerabilities, suggestion]);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: vulnerabilities.includes(suggestion) ? 'var(--qic-secondary)' : '#f0f0f0',
                    color: vulnerabilities.includes(suggestion) ? 'white' : 'inherit',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                  disabled={vulnerabilities.includes(suggestion)}
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {vulnerabilities.map((v) => (
              <span
                key={v}
                style={{
                  padding: '6px 12px',
                  background: 'var(--qic-secondary)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {v}
                <button
                  type="button"
                  onClick={() => setVulnerabilities(vulnerabilities.filter(vul => vul !== v))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                    marginLeft: 4
                  }}
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginTop: 8 }}>
            Click AI-suggested buttons above or type your own vulnerabilities
          </div>
        </div>
        
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={firstTimeBuyer} onChange={() => setFirstTimeBuyer(v => !v)} />
          {t('profile.firstTime') || 'I am a first-time insurance buyer'}
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={save} disabled={saving}>{saving ? (t('saving') || 'Saving…') : t('save')}</button>
        <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('profile.prefsHint') || 'Your preferences personalize missions and offers.'}</span>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12 }}>
        <label>
          {t('language')}
          <select value={i18n.language} onChange={(e) => { const lng = e.target.value; localStorage.setItem('lng', lng); i18n.changeLanguage(lng); setDirection(lng); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Insurance Preferences</div>
        <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginBottom: 8 }}>
          Select your insurance needs to get personalized recommendations
        </div>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['car', 'health', 'home', 'travel', 'life', 'motorcycle'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={insurancePreferences.includes(k)}
                  onChange={() => {
                    setInsurancePreferences(prev =>
                      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
                    );
                  }}
                />
                {k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Areas of Interest</div>
        <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginBottom: 8 }}>
          Select your interests to receive relevant offers and content
        </div>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['fashion', 'food', 'entertainment', 'electronics', 'family', 'travel', 'sports', 'technology'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={areasOfInterest.includes(k)}
                  onChange={() => {
                    setAreasOfInterest(prev =>
                      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
                    );
                  }}
                />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Preferences</div>
        <label>
          Mission Difficulty
          <select value={prefs.missionDifficulty} onChange={(e) => setPrefs((p: any) => ({ ...p, missionDifficulty: e.target.value }))}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <div>
          Engagement Frequency
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['daily', 'weekly'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="freq" checked={prefs.frequency === k} onChange={() => setPrefs((p: any) => ({ ...p, frequency: k }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>We'll tailor reminder timing accordingly.</div>
        </div>
        <div>
          Notifications
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['push', 'email', 'sms'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!prefs.notifications[k]} onChange={() => setPrefs((p: any) => ({ ...p, notifications: { ...p.notifications, [k]: !p.notifications[k] } }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Choose how you prefer to be notified.</div>
        </div>
      </div>

      {mostNeeded && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>{t('profile.mostNeeded') || 'Most needed insurance'}</div>
          <div style={{ marginTop: 6 }}>{mostNeeded.type} — {mostNeeded.reason}</div>
          {firstTimeBuyer && mostNeeded.type === 'car' && (
            <div style={{ marginTop: 8, padding: 8, background: '#d4edda', borderRadius: 6, fontSize: 14 }}>
              🎉 Special Offer: Get 3 months FREE insurance as a first-time buyer!
            </div>
          )}
        </div>
      )}

      {filteredOffers.length > 0 && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Exclusive Offers Tailored for You</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredOffers.map((offer, idx) => (
              <div key={idx} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{offer.title}</div>
                <div style={{ fontSize: 13, color: 'var(--qic-muted)' }}>{offer.conditions_simplified}</div>
              </div>
            ))}
          </div>
        </div>
      )}
            </>
          </SignedIn>
        </>
      ) : (
        <>
      {loading && <p>{t('loading')}</p>}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      
      {/* Profile Save Status Indicator */}
      {lastSaved && (
        <div className="qic-card" style={{ padding: 8, marginBottom: 12, background: '#e8f5e9', border: '1px solid #4caf50', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4caf50', fontSize: 16 }}>✓</span>
          <span>Profile saved at {lastSaved.toLocaleTimeString()}</span>
        </div>
      )}
      
      {!isProfileComplete && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12, background: '#fff3cd', border: '1px solid #ffc107' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Complete Your Profile</div>
          <div style={{ fontSize: 14 }}>
            Complete your profile to unlock mission generation. Required: Name, Age, Gender, Nationality, and at least one Insurance Preference.
          </div>
        </div>
      )}

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{t('profile.details') || 'Your Details'}</div>
        <label>
          {t('profile.name') || 'Name'}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.namePlaceholder') || 'Your name'} />
        </label>
        <label>
          Age
          <input
            type="range"
            min={18}
            max={100}
            step={1}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
          />
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{age} years old</div>
        </label>
        <label>
          Gender
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{t('profile.select') || 'Select'}</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label>
          {t('profile.nationality') || 'Nationality'}
          <select value={nationality} onChange={(e) => setNationality(e.target.value)}>
            <option value="">{t('profile.select') || 'Select'}</option>
            <option value="Qatari">Qatari</option>
            <option value="Expat">Expat</option>
            <option value="Visitor">Visitor</option>
          </select>
        </label>
        <label>
          {t('profile.budget') || 'Yearly insurance budget (QAR)'}
          <input type="range" min={0} max={30000} step={500} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{budget.toLocaleString()} QAR/year (Max: 30,000)</div>
        </label>
        
        <div>
          <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
            {t('profile.vulnerabilities') || 'Vulnerabilities (help us tailor discounts)'}
          </label>
          {suggestedVulnerabilities.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {suggestedVulnerabilities.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    if (!vulnerabilities.includes(suggestion)) {
                      setVulnerabilities([...vulnerabilities, suggestion]);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    background: vulnerabilities.includes(suggestion) ? 'var(--qic-secondary)' : '#f0f0f0',
                    color: vulnerabilities.includes(suggestion) ? 'white' : 'inherit',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                  disabled={vulnerabilities.includes(suggestion)}
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {vulnerabilities.map((v) => (
              <span
                key={v}
                style={{
                  padding: '6px 12px',
                  background: 'var(--qic-secondary)',
                  color: 'white',
                  borderRadius: 6,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {v}
                <button
                  type="button"
                  onClick={() => setVulnerabilities(vulnerabilities.filter(vul => vul !== v))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 0,
                    marginLeft: 4
                  }}
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginTop: 8 }}>
            Click AI-suggested buttons above or type your own vulnerabilities
          </div>
        </div>
        
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={firstTimeBuyer} onChange={() => setFirstTimeBuyer(v => !v)} />
          {t('profile.firstTime') || 'I am a first-time insurance buyer'}
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button onClick={save} disabled={saving}>{saving ? (t('saving') || 'Saving…') : t('save')}</button>
        <span style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('profile.prefsHint') || 'Your preferences personalize missions and offers.'}</span>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12 }}>
        <label>
          {t('language')}
          <select value={i18n.language} onChange={(e) => { const lng = e.target.value; localStorage.setItem('lng', lng); i18n.changeLanguage(lng); setDirection(lng); }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Insurance Preferences</div>
        <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginBottom: 8 }}>
          Select your insurance needs to get personalized recommendations
        </div>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['car', 'health', 'home', 'travel', 'life', 'motorcycle'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={insurancePreferences.includes(k)}
                  onChange={() => {
                    setInsurancePreferences(prev =>
                      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
                    );
                  }}
                />
                {k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Areas of Interest</div>
        <div style={{ fontSize: 12, color: 'var(--qic-muted)', marginBottom: 8 }}>
          Select your interests to receive relevant offers and content
        </div>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {['fashion', 'food', 'entertainment', 'electronics', 'family', 'travel', 'sports', 'technology'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={areasOfInterest.includes(k)}
                  onChange={() => {
                    setAreasOfInterest(prev =>
                      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
                    );
                  }}
                />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="qic-card-majlis" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Preferences</div>
        <label>
          Mission Difficulty
          <select value={prefs.missionDifficulty} onChange={(e) => setPrefs((p: any) => ({ ...p, missionDifficulty: e.target.value }))}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <div>
          Engagement Frequency
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['daily', 'weekly'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="freq" checked={prefs.frequency === k} onChange={() => setPrefs((p: any) => ({ ...p, frequency: k }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>We'll tailor reminder timing accordingly.</div>
        </div>
        <div>
          Notifications
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {['push', 'email', 'sms'].map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!prefs.notifications[k]} onChange={() => setPrefs((p: any) => ({ ...p, notifications: { ...p.notifications, [k]: !p.notifications[k] } }))} /> {k}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Choose how you prefer to be notified.</div>
        </div>
      </div>

      {mostNeeded && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>{t('profile.mostNeeded') || 'Most needed insurance'}</div>
          <div style={{ marginTop: 6 }}>{mostNeeded.type} — {mostNeeded.reason}</div>
          {firstTimeBuyer && mostNeeded.type === 'car' && (
            <div style={{ marginTop: 8, padding: 8, background: '#d4edda', borderRadius: 6, fontSize: 14 }}>
              🎉 Special Offer: Get 3 months FREE insurance as a first-time buyer!
            </div>
          )}
        </div>
      )}

      {filteredOffers.length > 0 && (
        <div className="qic-card" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Exclusive Offers Tailored for You</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredOffers.map((offer, idx) => (
              <div key={idx} style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{offer.title}</div>
                <div style={{ fontSize: 13, color: 'var(--qic-muted)' }}>{offer.conditions_simplified}</div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      ))}
    </MajlisLayout>
  );
}
