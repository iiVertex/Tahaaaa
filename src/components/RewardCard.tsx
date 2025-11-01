import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

type Reward = {
  id: string;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  coins_cost?: number;
  xp_reward?: number;
  category?: string;
  is_redeemed?: boolean;
  coupon_code?: string;
};

export default function RewardCard({ reward, onRedeem, loading, userCoins }:{ reward: Reward; onRedeem: (id:string)=>void; loading?: boolean; userCoins?: number }) {
  // Null-safety: Ensure reward is valid
  if (!reward || !reward.id) {
    console.warn('[RewardCard] Invalid reward provided:', reward);
    return null;
  }
  
  const [open, setOpen] = useState(false);
  const isRedeemed = reward.is_redeemed || false;
  const canAfford = typeof userCoins === 'number' ? (userCoins >= (reward.coins_cost || 0)) : true;
  
  return (
    <div 
      className="qic-card" 
      style={{ 
        padding: 12, 
        opacity: isRedeemed ? 0.6 : 1,
        background: isRedeemed ? '#f5f5f5' : undefined,
        position: 'relative'
      }}
    >
      {isRedeemed && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: '#6c757d', 
          color: 'white', 
          fontSize: 10, 
          padding: '2px 6px', 
          borderRadius: 4 
        }}>
          Purchased
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <b>{reward.title_en || reward.title || reward.id}</b>
          <div style={{ opacity: 0.8 }}>{reward.description_en || reward.description}</div>
          <div style={{ opacity: 0.7 }}>Cost: {reward.coins_cost ?? 0} coins</div>
          {isRedeemed && reward.coupon_code && (
            <div style={{ marginTop: 8, padding: 8, background: '#d4edda', border: '1px solid #28a745', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>Coupon Code:</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#155724' }}>
                {reward.coupon_code}
              </div>
            </div>
          )}
        </div>
        {!isRedeemed && (
          <AlertDialog.Root open={open} onOpenChange={setOpen}>
            <AlertDialog.Trigger asChild>
              <button 
                style={{ 
                  background: canAfford ? 'var(--qic-accent)' : '#ccc', 
                  borderColor: canAfford ? 'var(--qic-accent)' : '#ccc',
                  cursor: canAfford ? 'pointer' : 'not-allowed'
                }} 
                disabled={loading || !canAfford}
                title={!canAfford ? `You need ${(reward.coins_cost || 0) - (userCoins || 0)} more coins` : undefined}
              >
                Redeem
              </button>
            </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
            <AlertDialog.Content style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--qic-surface)', border: '1px solid var(--qic-border)', borderRadius: 12, padding: 16, width: 320 }}>
              <AlertDialog.Title style={{ fontWeight: 700, marginBottom: 6 }}>Redeem Reward?</AlertDialog.Title>
              <AlertDialog.Description>
                This will cost <b>{reward.coins_cost ?? 0}</b> coins.
                {typeof userCoins === 'number' && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--qic-muted)' }}>After redeem: {Math.max(0, (userCoins || 0) - (reward.coins_cost || 0))} coins</div>
                )}
              </AlertDialog.Description>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <AlertDialog.Cancel asChild>
                  <button style={{ background: 'transparent', color: 'var(--qic-primary)', borderColor: 'var(--qic-primary)' }}>Cancel</button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button onClick={() => { onRedeem(reward.id); setOpen(false); }}>Confirm</button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
        )}
      </div>
    </div>
  );
}


