import React from 'react';
import { useCoins } from '@/lib/coins';
import { useInsuranceCart } from '@/contexts/InsuranceCartContext';
import { useNavigate } from 'react-router-dom';

export default function CoinsCounter() {
  const { coins, refreshCoins, isLoading } = useCoins();
  
  // Hooks must be called unconditionally
  // If context/route is not available, the hook will throw and React will handle it
  // But we can provide fallbacks in the component logic
  const cart = useInsuranceCart();
  const navigate = useNavigate();
  
  const cartItemCount = cart?.cartItemCount || 0;
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshCoins();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center' }}>
      {/* Cart Badge */}
      {cartItemCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--qic-primary)',
            color: 'white',
            borderRadius: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onClick={() => {
            try {
              navigate('/insurance-cart');
            } catch (error) {
              // Fallback if navigate fails
              window.location.href = '/insurance-cart';
            }
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="View cart"
        >
          <span>🛒</span>
          <span>{cartItemCount}</span>
        </div>
      )}
      
      {/* Coins Counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: 'linear-gradient(135deg, var(--qic-secondary) 0%, var(--qic-accent) 100%)',
          color: 'white',
          borderRadius: 24,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={handleRefresh}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title="Click to refresh coins"
    >
      <span style={{ fontSize: 20 }}>💰</span>
      <span>{isLoading ? '...' : coins.toLocaleString()}</span>
      {isRefreshing && (
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid white',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );
}

