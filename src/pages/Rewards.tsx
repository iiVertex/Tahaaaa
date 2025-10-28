import React, { useEffect, useState } from 'react';
import { getRewards, redeemReward, getProfile } from '@/lib/api';
import RewardCard from '@/components/RewardCard';
import BottomNav from '@/components/BottomNav';
import { CardSkeleton } from '@/components/Skeletons';

export default function Rewards() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getRewards().catch((e) => { setError(e?.message || 'Failed to load rewards'); return []; }),
      getProfile().catch(() => null)
    ])
      .then(([list, prof]) => {
        setRewards(list || []);
        const c = (prof as any)?.user?.coins ?? (prof as any)?.stats?.coins ?? 0;
        setCoins(c);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: 64 }}>
      <h2>Rewards</h2>
      <div style={{ marginBottom: 8 }}>Coins: <b>{coins}</b></div>
      {loading && (<div style={{ display: 'grid', gap: 8 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>)}
      {error && <p style={{ color: 'salmon' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {rewards.map((r) => (
          <RewardCard key={r.id} reward={r} onRedeem={(id)=>redeemReward(id).then(()=>{})} />
        ))}
      </div>
      <BottomNav />
    </div>
  );
}


