import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import ar from '@/locales/ar.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en as any },
      ar: { translation: ar as any }
    },
    lng: (localStorage.getItem('lng') || 'en'),
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export function setDirection(lang: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }
}

setDirection(i18n.language);

export default i18n;


