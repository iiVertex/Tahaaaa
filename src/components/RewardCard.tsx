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
};

export default function RewardCard({ reward, onRedeem, loading, userCoins }:{ reward: Reward; onRedeem: (id:string)=>void; loading?: boolean; userCoins?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="qic-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <b>{reward.title_en || reward.title || reward.id}</b>
          <div style={{ opacity: 0.8 }}>{reward.description_en || reward.description}</div>
          <div style={{ opacity: 0.7 }}>Cost: {reward.coins_cost ?? 0} coins</div>
        </div>
        <AlertDialog.Root open={open} onOpenChange={setOpen}>
          <AlertDialog.Trigger asChild>
            <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} disabled={loading}>Redeem</button>
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
      </div>
    </div>
  );
}


