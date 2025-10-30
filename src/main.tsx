import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import './index.css';
import './lib/i18n';
import App from './App';
import { track } from './lib/analytics';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoinsProvider } from '@/lib/coins';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000,
      retry: (import.meta as any).env?.DEV ? false : 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CoinsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </CoinsProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// Track return_session after app mounts
try { track('return_session'); } catch {}

// Dev safeguard: warn if any full-screen overlay could block interactions
if ((import.meta as any).env?.DEV) {
  setTimeout(() => {
    try {
      const blockers: Element[] = [];
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
      for (const el of all) {
        const style = getComputedStyle(el);
        const pos = style.position;
        const inset0 = style.top === '0px' && style.left === '0px' && style.right === '0px' && style.bottom === '0px';
        const pe = style.pointerEvents;
        if ((pos === 'fixed' || pos === 'absolute') && inset0 && pe !== 'none') {
          // Skip known interactive overlays (dialogs, toasts, drawers)
          const role = el.getAttribute('role') || '';
          const isDialog = role === 'dialog' || el.closest('[data-radix-portal]');
          if (!isDialog) blockers.push(el);
        }
      }
      if (blockers.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('Potential overlay blockers found:', blockers.slice(0,3));
      }
    } catch {}
  }, 0);
}


