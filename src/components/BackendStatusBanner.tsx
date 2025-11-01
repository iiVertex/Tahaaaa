import React from 'react';
import { health } from '@/lib/api';
import { useToast } from '@/components/Toast';

/**
 * Development-only component that checks backend health and shows helpful message when down
 * Only renders in development mode
 */
export default function BackendStatusBanner() {
  const [backendDown, setBackendDown] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [firstCheck, setFirstCheck] = React.useState(true);
  const toast = useToast();
  const isDev = import.meta.env.DEV;

  React.useEffect(() => {
    if (!isDev || dismissed) return;

    let intervalId: NodeJS.Timeout;
    let mounted = true;
    let hasShownToast = false;

    const checkBackend = async () => {
      try {
        await health();
        if (mounted) {
          setBackendDown(false);
        }
      } catch (error: any) {
        if (mounted) {
          setBackendDown(true);
          // Show toast only once on first detection
          if (firstCheck && !hasShownToast && (error?.message?.includes('Network') || error?.code === 'ERR_NETWORK' || error?.code === 'ECONNREFUSED')) {
            toast?.error?.('Backend server not running. Using offline fallbacks.');
            hasShownToast = true;
            setFirstCheck(false);
          }
        }
      }
    };

    // Check immediately
    checkBackend();

    // Then check every 5 seconds
    intervalId = setInterval(checkBackend, 5000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isDev, dismissed, toast, firstCheck]);

  if (!isDev || dismissed || !backendDown) return null;

  const copyCommand = () => {
    navigator.clipboard.writeText('npm run dev:both');
    toast?.success?.('Command copied!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 40, // Below OfflineBanner
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'white',
        border: '2px solid #ef4444',
        borderRadius: 8,
        padding: 16,
        maxWidth: 500,
        zIndex: 9998,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
            🔧 Backend Server Not Running
          </div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            The backend API server (localhost:3001) is not running. Start it to enable full functionality.
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            padding: 0,
            marginLeft: 8,
            color: '#666'
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code
          style={{
            background: '#f5f5f5',
            padding: '6px 12px',
            borderRadius: 4,
            fontSize: 13,
            fontFamily: 'monospace',
            flex: 1
          }}
        >
          npm run dev:both
        </code>
        <button
          onClick={copyCommand}
          style={{
            padding: '6px 12px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500
          }}
        >
          Copy
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
        Or run separately: <code style={{ background: '#f5f5f5', padding: '2px 4px' }}>npm run backend:dev</code> in the backend folder
      </div>
    </div>
  );
}

