import React, { createContext, useContext, useMemo, useState } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';

type ToastItem = { id: number; title: string; description?: string; variant?: 'success'|'error' };
type ToastApi = { success: (title: string, description?: string)=>void; error: (title: string, description?: string)=>void };

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }:{ children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const api = useMemo<ToastApi>(() => ({
    success: (title, description) => setToasts((t) => [...t, { id: Date.now() + Math.random(), title, description, variant: 'success' }]),
    error: (title, description) => setToasts((t) => [...t, { id: Date.now() + Math.random(), title, description, variant: 'error' }])
  }), []);

  return (
    <ToastCtx.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root key={t.id} open onOpenChange={(o)=>{ if (!o) setToasts((arr)=>arr.filter(x=>x.id!==t.id)); }}
            style={{
              background: t.variant === 'error' ? '#800000' : '#FFD700',
              color: t.variant === 'error' ? '#fff' : '#111', padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)',
              position: 'fixed', bottom: 80, right: 16, minWidth: 260,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255,255,255,0.18) 0, rgba(255,255,255,0) 60%), var(--pattern-mosaic)',
              backgroundSize: 'auto, 16px 16px',
              backgroundBlendMode: 'overlay',
              transform: 'translateY(20px)', transition: 'transform 180ms ease, opacity 180ms ease', opacity: 1
            }}>
            <ToastPrimitive.Title style={{ fontWeight: 700 }} aria-live="polite">{t.title}</ToastPrimitive.Title>
            {t.description && <ToastPrimitive.Description>{t.description}</ToastPrimitive.Description>}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport style={{ position: 'fixed', bottom: 0, right: 0 }} />
      </ToastPrimitive.Provider>
    </ToastCtx.Provider>
  );
}


