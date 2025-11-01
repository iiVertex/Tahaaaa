import React, { useState } from 'react';
import { startQuote } from '@/lib/api';
import { trackFeatureUsageThrottled } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useTranslation } from 'react-i18next';
import { useCoins } from '@/lib/coins';
import { useQueryClient } from '@tanstack/react-query';
import { getProfile } from '@/lib/api';

export default function QuoteDrawer({ open, onClose, productId }:{ open: boolean; onClose: ()=>void; productId?: string }) {
  const { t } = useTranslation();
  const { refreshCoins } = useCoins();
  const qc = useQueryClient();
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)' }} onClick={onClose}>
      <div className="qic-card" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 340, padding: 16 }} onClick={(e)=>e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>{t('quote.startTitle') || 'Start Quote'}</b>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}>{t('close') || 'Close'}</button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <label>{t('quote.age') || 'Age'}<input value={age} onChange={(e)=>setAge(e.target.value)} placeholder="e.g. 32" /></label>
          <label>{t('quote.city') || 'City'}<input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="e.g. Doha" /></label>
          <button disabled={busy} onClick={async ()=>{
            setBusy(true);
            try {
              track('quote_start', { product_id: productId });
              await trackFeatureUsageThrottled('quote_start', { product_id: productId });
              await startQuote({ product_id: productId, inputs: { age, city } });
              track('quote_complete', { product_id: productId });
              await trackFeatureUsageThrottled('quote_complete', { product_id: productId });
              await qc.invalidateQueries({ queryKey: ['profile'] });
              await refreshCoins(); // Refresh coins from backend
              onClose();
            } finally { setBusy(false); }
          }}>{busy ? (t('quote.starting') || 'Starting…') : (t('quote.cta') || 'Get Estimate')}</button>
        </div>
      </div>
    </div>
  );
}


