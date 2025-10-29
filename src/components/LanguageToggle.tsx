import React, { useEffect, useState } from 'react';
import i18n, { setDirection } from '@/lib/i18n';

export default function LanguageToggle() {
  const [lng, setLng] = useState<string>(i18n.language);
  useEffect(() => {
    const h = (l: any) => {
      setLng(i18n.language);
      setDirection(i18n.language);
    };
    i18n.on('languageChanged', h);
    return () => { i18n.off('languageChanged', h); };
  }, []);
  const toggle = () => {
    const next = lng === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lng', next);
    i18n.changeLanguage(next);
  };
  return (
    <button onClick={toggle} aria-label="Toggle language" style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}>
      {lng === 'ar' ? 'EN' : 'عربي'}
    </button>
  );
}


