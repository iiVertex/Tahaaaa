import React from 'react';

export function ToastHost({ message, error }:{ message?: string|null; error?: string|null }) {
  if (!message && !error) return null;
  const bg = error ? 'salmon' : 'seagreen';
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', bottom: 72, left: 16, right: 16 }}>
      <div style={{ background: bg, color: 'white', padding: 12, borderRadius: 8, textAlign: 'center' }}>
        {error || message}
      </div>
    </div>
  );
}


