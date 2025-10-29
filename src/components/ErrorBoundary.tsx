import React from 'react';
import { useTranslation } from 'react-i18next';

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // Could send to monitoring here
    // console.error('App error', error, info);
  }
  render() {
    // Note: hooks are not allowed in class, so we read translations via window.i18next if available
    // Fallback to English strings if not.
    const t = (key: string, fallback: string) => {
      try { return (window as any).i18next?.t?.(key) || fallback; } catch { return fallback; }
    };
    if (this.state.hasError) {
      return (
        <div role="alert" className="qic-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>{t('error.title', 'Something went wrong')}</div>
          <div>{t('error.reload', 'Please try reloading the page.')}</div>
          <div>
            <button onClick={() => window.location.reload()}>{t('reload', 'Reload')}</button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}


