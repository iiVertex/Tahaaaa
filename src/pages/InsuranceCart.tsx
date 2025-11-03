import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInsuranceCart } from '@/contexts/InsuranceCartContext';
import MajlisLayout from '@/components/MajlisLayout';
import { DatePalmIcon } from '@/components/QatarAssets';
import { useToast } from '@/components/Toast';
import { track } from '@/lib/analytics';

export default function InsuranceCart() {
  const { t } = useTranslation();
  const { cart, removeFromCart, clearCart, cartItemCount } = useInsuranceCart();
  const toast = useToast();

  const handleRemove = (planId: string, planName: string) => {
    removeFromCart(planId);
    toast?.success?.('Removed from cart', `${planName} removed`);
    try { track('cart_remove', { plan_id: planId, plan_name: planName }); } catch {}
  };

  const handleClear = () => {
    if (window.confirm(t('cart.clearConfirm') || 'Are you sure you want to clear your cart?')) {
      clearCart();
      toast?.success?.('Cart cleared', 'All items removed');
      try { track('cart_clear'); } catch {}
    }
  };

  if (cartItemCount === 0) {
    return (
      <MajlisLayout titleKey="cart.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
        {/* Welcome Description */}
        <div className="qic-card-majlis" style={{ 
          padding: 20, 
          marginBottom: 20, 
          background: 'linear-gradient(135deg, rgba(68, 64, 151, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
          border: '2px solid var(--qic-secondary)',
          borderRadius: 12
        }}>
          <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
            <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>🛒 Build Your Perfect Protection Plan</strong>
            <p style={{ margin: '12px 0 0 0' }}>
              Your insurance cart is where your personalized protection plan comes together. Add insurance products that match your lifestyle 
              and needs, compare coverage options, and see how bundling can save you money. Once you're ready, get instant quotes and complete 
              your purchase—all in one place. Your peace of mind is just a few clicks away.
            </p>
          </div>
        </div>
        <div className="qic-card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('cart.empty') || 'Your cart is empty'}</h3>
          <p style={{ fontSize: 14, color: 'var(--qic-muted)', marginBottom: 24 }}>
            {t('cart.emptyDescription') || 'Add insurance plans from AI Simulate to get started'}
          </p>
          <button
            onClick={() => window.location.href = '/showcase'}
            style={{
              padding: '12px 24px',
              background: 'var(--qic-secondary)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('cart.browsePlans') || 'Browse Insurance Plans'}
          </button>
        </div>
      </MajlisLayout>
    );
  }

  return (
    <MajlisLayout titleKey="cart.title" icon={<DatePalmIcon size={18} color="var(--qic-secondary)" />}>
      {/* Welcome Description */}
      <div className="qic-card-majlis" style={{ 
        padding: 20, 
        marginBottom: 20, 
        background: 'linear-gradient(135deg, rgba(68, 64, 151, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        border: '2px solid var(--qic-secondary)',
        borderRadius: 12
      }}>
        <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--qic-text)' }}>
          <strong style={{ color: 'var(--qic-primary)', fontSize: 18 }}>🛒 Build Your Perfect Protection Plan</strong>
          <p style={{ margin: '12px 0 0 0' }}>
            Your insurance cart is where your personalized protection plan comes together. Add insurance products that match your lifestyle 
            and needs, compare coverage options, and see how bundling can save you money. Once you're ready, get instant quotes and complete 
            your purchase—all in one place. Your peace of mind is just a few clicks away.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            {t('cart.title') || 'Insurance Cart'}
          </h2>
          <div style={{ fontSize: 14, color: 'var(--qic-muted)' }}>
            {cartItemCount} {cartItemCount === 1 ? t('cart.item') || 'item' : t('cart.items') || 'items'}
          </div>
        </div>
        {cartItemCount > 0 && (
          <button
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid #dc3545',
              color: '#dc3545',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('cart.clear') || 'Clear Cart'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {cart.items.map((item, index) => (
          <div key={item.plan_id || item.plan_name || index} className="qic-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--qic-primary)' }}>
                  {item.plan_name}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--qic-muted)', marginBottom: 8 }}>
                  {item.insurance_type || item.plan_type || 'Insurance Plan'}
                </div>
                {item.description && (
                  <p style={{ fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
                    {item.description}
                  </p>
                )}
                {item.estimated_premium && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--qic-secondary)' }}>
                    {t('cart.estimatedPremium') || 'Estimated Premium:'} {item.estimated_premium}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemove(item.plan_id || item.plan_name, item.plan_name)}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #dc3545',
                  color: '#dc3545',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 16
                }}
              >
                {t('cart.remove') || 'Remove'}
              </button>
            </div>

            {/* Display scenarios if available */}
            {item.scenarios && Array.isArray(item.scenarios) && item.scenarios.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {t('cart.scenarios') || 'Scenarios:'}
                </div>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12, color: '#666' }}>
                  {item.scenarios.slice(0, 3).map((scenario: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{scenario}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.added_at && (
              <div style={{ fontSize: 11, color: '#999', marginTop: 8, fontStyle: 'italic' }}>
                {t('cart.added') || 'Added'} {new Date(item.added_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="qic-card" style={{ padding: 20, marginTop: 24, background: 'linear-gradient(135deg, var(--qic-primary) 0%, var(--qic-secondary) 100%)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {t('cart.total') || 'Total Plans:'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {cartItemCount}
          </div>
        </div>
        <button
          onClick={() => {
            toast?.info?.('Contact QIC', 'To proceed with these plans, please contact QIC customer service');
            try { track('cart_checkout', { item_count: cartItemCount }); } catch {}
          }}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: 'white',
            color: 'var(--qic-primary)',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 8
          }}
        >
          {t('cart.contactQIC') || 'Contact QIC to Get Quotes'}
        </button>
      </div>
    </MajlisLayout>
  );
}

