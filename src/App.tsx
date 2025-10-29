import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
const Health = React.lazy(() => import('./pages/Health'));
const Play = React.lazy(() => import('./pages/Play'));
const Rewards = React.lazy(() => import('./pages/Rewards'));
const Missions = React.lazy(() => import('./pages/Missions'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Social = React.lazy(() => import('./pages/Social'));
const Scenarios = React.lazy(() => import('./pages/Scenarios'));
const Showcase = React.lazy(() => import('./pages/Showcase'));
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import LanguageToggle from '@/components/LanguageToggle';
import { useTranslation } from 'react-i18next';

export default function App() {
  const { t } = useTranslation();
  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/play', label: t('play.title') },
    { to: '/missions', label: t('missions.title') },
    { to: '/rewards', label: t('rewards.title') },
    { to: '/achievements', label: t('achievements.title') },
    { to: '/scenarios', label: t('scenarios.title') },
    { to: '/social', label: t('social.title') },
    { to: '/profile', label: t('profile.title') },
    { to: '/showcase', label: t('showcase.title') }
  ];
  return (
    <div style={{ padding: 16 }}>
      <a href="#main" className="skip-to-content">Skip to content</a>
      <h1 style={{ color: 'var(--qic-primary)' }}>QIC Life MVP</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--qic-secondary)' : 'inherit'
            })}
          >
            {item.label}
          </NavLink>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <LanguageToggle />
        </span>
      </nav>
      <div id="main" className="qic-card" style={{ padding: 16 }}>
        <ToastProvider>
          <ErrorBoundary>
            <React.Suspense fallback={<div style={{ padding: 12 }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<Health />} />
              <Route path="/play" element={<Play />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/social" element={<Social />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/showcase" element={<Showcase />} />
            </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </div>
    </div>
  );
}


