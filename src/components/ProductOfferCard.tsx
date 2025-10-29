import React from 'react';
import { useTranslation } from 'react-i18next';

type Offer = { product_id: string; name: string; type?: string; estimated_premium?: number; savings_if_bundled?: number; rationale?: string; cta?: string };

export default function ProductOfferCard({ offer, onCta }:{ offer: Offer; onCta: (offer: Offer)=>void }) {
  const { t } = useTranslation();
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>{offer.name}</div>
        {typeof offer.estimated_premium === 'number' && (
          <div style={{ color: 'var(--qic-primary)' }}>~{offer.estimated_premium} QAR/mo</div>
        )}
      </div>
      {offer.savings_if_bundled ? (
        <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Save up to {offer.savings_if_bundled}% when bundled</div>
      ) : null}
      {offer.rationale && (<div style={{ fontSize: 12 }}>{offer.rationale}</div>)}
      <div>
        <button onClick={() => onCta(offer)}>{offer.cta || t('quote.cta') || 'Get Quote'}</button>
      </div>
    </div>
  );
}


