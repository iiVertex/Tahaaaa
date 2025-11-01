import React from 'react';
import { subscribeToConnectionStatus, getBackendStatus } from '@/lib/requests';

export default function OfflineBanner() {
  const [backendDown, setBackendDown] = React.useState(false);
  const [internetDown, setInternetDown] = React.useState(false);

  React.useEffect(() => {
    // Check initial state
    setBackendDown(getBackendStatus());
    
    const unsubscribe = subscribeToConnectionStatus((backend, internet) => {
      setBackendDown(backend);
      setInternetDown(internet);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Only show if there's a real issue
  // Don't show "Internet lost" unless browser confirms we're offline
  const isActuallyOffline = internetDown && typeof navigator !== 'undefined' && navigator.onLine === false;
  
  if (!backendDown && !isActuallyOffline) return null;

  const message = backendDown 
    ? "⚠️ Backend server unavailable. Start it with: npm run dev:both"
    : isActuallyOffline
    ? "⚠️ Internet connection lost. Retrying..."
    : null;
  
  if (!message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#ef4444',
        color: 'white',
        padding: '8px 16px',
        textAlign: 'center',
        zIndex: 9999,
        fontSize: '14px',
        fontWeight: 500
      }}
    >
      {message}
    </div>
  );
}

