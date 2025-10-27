import React from 'react';

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

export default function RewardCard({ reward, onRedeem, loading }:{ reward: Reward; onRedeem: (id:string)=>void; loading?: boolean }) {
  return (
    <div className="qic-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <b>{reward.title_en || reward.title || reward.id}</b>
          <div style={{ opacity: 0.8 }}>{reward.description_en || reward.description}</div>
          <div style={{ opacity: 0.7 }}>Cost: {reward.coins_cost ?? 0} coins</div>
        </div>
        <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={() => onRedeem(reward.id)} disabled={loading}>Redeem</button>
      </div>
    </div>
  );
}


