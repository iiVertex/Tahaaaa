import React, { useEffect, useMemo, useState } from 'react';
import { getProductsCatalog, getBundleSavings } from '@/lib/api';
import { useTranslation } from 'react-i18next';

type Product = { id: string; name: string; base_premium?: number; eligible?: boolean };

export default function BundleCalculator({ onStartQuote }:{ onStartQuote?: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savings, setSavings] = useState<any | null>(null);

  useEffect(() => {
    getProductsCatalog().then((p:any)=> setProducts(p || [])).catch(()=> setProducts([]));
  }, []);

  useEffect(() => {
    if (selected.length >= 1) {
      getBundleSavings(selected).then((r:any)=> setSavings(r?.data || r)).catch(()=> setSavings(null));
    } else {
      setSavings(null);
    }
  }, [selected]);

  const subtotal = useMemo(() => {
    return products.filter(p => selected.includes(p.id)).reduce((s, p) => s + (p.base_premium || 0), 0);
  }, [products, selected]);

  const toggle = (id: string) => {
    setSelected((arr) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{t('bundle.title')}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {products.map((p) => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
            <span style={{ opacity: p.eligible === false ? 0.6 : 1 }}>{p.name} — {p.base_premium ?? 0} QAR/mo</span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>{t('bundle.subtotal', { amount: subtotal }) || `Subtotal: ${subtotal} QAR/mo`}</div>
      {savings && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div>{t('bundle.savings', { percent: Math.round((savings.savings_percent || 0) * 100), amount: savings.savings_amount })}</div>
          <div>{t('bundle.totalAfter', { amount: savings.total })}</div>
        </div>
      )}
      <div>
        <button onClick={() => onStartQuote?.(selected)} disabled={selected.length < 1}>{t('quote.cta') || 'Start Quote'}</button>
      </div>
    </div>
  );
}


