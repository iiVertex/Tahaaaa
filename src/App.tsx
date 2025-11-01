import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ClerkProvider, useAuth, SignInButton, SignUpButton, UserButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { setClerkTokenGetter } from '@/lib/requests';
import { trackFeatureUsageThrottled } from '@/lib/api';
const Health = React.lazy(() => import('./pages/Health'));
const Play = React.lazy(() => import('./pages/Play'));
const Rewards = React.lazy(() => import('./pages/Rewards'));
const Missions = React.lazy(() => import('./pages/Missions'));
const Achievements = React.lazy(() => import('./pages/Achievements'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Scenarios = React.lazy(() => import('./pages/Scenarios'));
const Showcase = React.lazy(() => import('./pages/Showcase'));
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import LanguageToggle from '@/components/LanguageToggle';
import OfflineBanner from '@/components/OfflineBanner';
import BackendStatusBanner from '@/components/BackendStatusBanner';
import { useTranslation } from 'react-i18next';

// Clerk publishable key - will be undefined if not configured (graceful degradation)
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

// Component to register Clerk token getter (must be inside ClerkProvider)
function ClerkTokenProvider() {
  const { getToken } = useAuth();
  
  React.useEffect(() => {
    // Register token getter for axios interceptor
    setClerkTokenGetter(async () => {
      try {
        return await getToken();
      } catch (error) {
        return null;
      }
    });
    
    return () => {
      // Cleanup: remove token getter when component unmounts
      setClerkTokenGetter(null);
    };
  }, [getToken]);
  
  return null; // This component doesn't render anything
}

// Main App component - wrapped with ClerkProvider if Clerk is configured
function AppContent() {
  const { t } = useTranslation();
  const location = useLocation();
  React.useEffect(() => {
    const path = location.pathname || '/';
    trackFeatureUsageThrottled('nav', { path });
  }, [location]);
  
  // Startup health check - only on initial mount
  React.useEffect(() => {
    const checkBackendOnStartup = async () => {
      if (!import.meta.env.DEV) return;
      
      try {
        const { health } = await import('@/lib/api');
        await health();
      } catch (error: any) {
        // Backend is down on startup - BackendStatusBanner will handle the UI
        console.warn('[Startup] Backend server not running. Start it with: npm run dev:both');
      }
    };
    checkBackendOnStartup();
  }, []); // Only run once on mount
  
  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/play', label: t('play.title') },
    { to: '/missions', label: t('missions.title') },
    { to: '/rewards', label: t('rewards.title') },
    { to: '/achievements', label: t('achievements.title') },
    { to: '/scenarios', label: t('scenarios.title') },
    { to: '/profile', label: t('profile.title') },
    { to: '/showcase', label: t('showcase.title') }
  ];
  return (
    <ToastProvider>
      <div style={{ padding: 16 }}>
        <OfflineBanner />
        <BackendStatusBanner />
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
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <LanguageToggle />
            {CLERK_PUBLISHABLE_KEY && (
              <>
                <SignedOut>
                  <SignInButton 
                    mode="modal"
                    fallbackRedirectUrl={typeof window !== 'undefined' ? window.location.pathname : '/'}
                    signUpFallbackRedirectUrl={typeof window !== 'undefined' ? window.location.pathname : '/'}
                  >
                    <button style={{ fontSize: 14, padding: '8px 16px', transition: 'all 0.2s' }}>{t('auth.signIn') || 'Sign In'}</button>
                  </SignInButton>
                  <SignUpButton 
                    mode="modal"
                    fallbackRedirectUrl={typeof window !== 'undefined' ? window.location.pathname : '/'}
                    signInFallbackRedirectUrl={typeof window !== 'undefined' ? window.location.pathname : '/'}
                  >
                    <button style={{ fontSize: 14, padding: '8px 16px', background: 'var(--qic-secondary)', transition: 'all 0.2s' }}>{t('auth.signUp') || 'Sign Up'}</button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton 
                    appearance={{
                      elements: {
                        avatarBox: 'w-10 h-10'
                      }
                    }}
                    showName={true}
                  />
                </SignedIn>
              </>
            )}
          </span>
        </nav>
        <div id="main" className="qic-card" style={{ padding: 16 }}>
          <ErrorBoundary>
            <React.Suspense fallback={<div style={{ padding: 12 }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<Health />} />
              <Route path="/play" element={<Play />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/showcase" element={<Showcase />} />
            </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </ToastProvider>
  );
}

// Export default - wrap with ClerkProvider if configured, otherwise just return AppContent
export default function App() {
  // If Clerk is configured, wrap with ClerkProvider
  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider 
        publishableKey={CLERK_PUBLISHABLE_KEY}
        appearance={{
          variables: {
            colorPrimary: '#444097',
            colorText: '#2E2E2E',
            colorBackground: '#FAFAFA',
            borderRadius: '8px'
          },
          elements: {
            formButtonPrimary: 'bg-[#444097] hover:bg-[#3a3685] text-white transition-colors',
            card: 'shadow-lg',
            headerTitle: 'text-[#444097]',
            headerSubtitle: 'text-gray-600',
            socialButtonsBlockButton: 'border-gray-300 hover:bg-gray-50 transition-colors',
            formFieldInput: 'border-gray-300 focus:border-[#444097] focus:ring-2 focus:ring-[#444097]',
            formFieldLabel: 'text-gray-700',
            footerActionLink: 'text-[#444097] hover:text-[#3a3685]',
            formFieldInputShowPasswordButton: 'text-[#444097] hover:text-[#3a3685]'
          }
        }}
        signInUrl="/#/sign-in"
        signUpUrl="/#/sign-up"
      >
        <ClerkTokenProvider />
        <AppContent />
      </ClerkProvider>
    );
  }
  
  // Otherwise, just return AppContent without Clerk
  return <AppContent />;
}

