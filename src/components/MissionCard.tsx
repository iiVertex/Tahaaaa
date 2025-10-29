import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { cardEntranceVariants } from '@/lib/animations';
import { DatePalmIcon, DallahIcon, IslamicStarPattern } from '@/components/QatarAssets';
import * as Popover from '@radix-ui/react-popover';

type Mission = {
  id: string;
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  category?: string;
  difficulty?: string;
  xp_reward?: number;
  lifescore_impact?: number;
  ai_rationale?: string;
  product_spotlight?: { product_id: string; name?: string } | boolean;
};

export default function MissionCard({ mission, onStart, onComplete, loading }:{ mission: Mission; onStart: (id:string)=>Promise<void>|void; onComplete: (id:string)=>Promise<void>|void; loading?: boolean }) {
  const [busy, setBusy] = React.useState<'start'|'complete'|null>(null);
  const [done, setDone] = React.useState(false);
  const categoryIcon = React.useMemo(() => {
    switch (mission.category) {
      case 'health': return <DatePalmIcon size={14} color={'var(--qic-secondary)'} />;
      case 'wellness': return <DallahIcon size={14} color={'var(--qic-secondary)'} />;
      case 'safe_driving': return <IslamicStarPattern size={14} color={'var(--qic-secondary)'} />;
      default: return <IslamicStarPattern size={14} color={'var(--qic-secondary)'} />;
    }
  }, [mission.category]);
  const stars = React.useMemo(() => {
    const d = (mission.difficulty || 'easy').toLowerCase();
    const count = d === 'hard' ? 3 : d === 'medium' ? 2 : 1;
    return Array.from({ length: count }).map((_, i) => (
      <span key={i} aria-hidden>★</span>
    ));
  }, [mission.difficulty]);
  const handleStart = async () => {
    try { setBusy('start'); await onStart(mission.id); } finally { setBusy(null); }
  };
  const handleComplete = async () => {
    try { setBusy('complete'); await onComplete(mission.id); setDone(true); } finally { setBusy(null); }
  };
  return (
    <motion.div className="qic-card" style={{ padding: 12, opacity: done ? 0.6 : 1, position: 'relative' }} variants={cardEntranceVariants} initial="initial" animate="animate">
      {mission.product_spotlight ? (
        <div aria-label="Product spotlight" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--qic-accent)', color: '#111', fontSize: 10, padding: '2px 6px', borderRadius: 6 }}>
          Spotlight
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {categoryIcon}
            <b>{mission.title_en || mission.title || mission.id}</b>
          </div>
          <div style={{ opacity: 0.8 }}>{mission.description_en || mission.description}</div>
          <div style={{ opacity: 0.7, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>XP: {mission.xp_reward ?? 10}</span>
            {mission.lifescore_impact ? <span>· LifeScore +{mission.lifescore_impact}</span> : null}
            <span aria-label={`Difficulty ${mission.difficulty || 'easy'}`} style={{ color: 'var(--qic-secondary)' }}>{stars}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button onClick={handleStart} disabled={loading || !!busy || done} aria-busy={busy==='start'} aria-label="Start mission">
                  {busy==='start' ? 'Starting…' : 'Start'}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" style={{ background: 'var(--qic-primary)', color: 'white', padding: '4px 8px', borderRadius: 6 }}>
                Begin mission
              </Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button style={{ background: 'var(--qic-accent)', borderColor: 'var(--qic-accent)' }} onClick={handleComplete} disabled={loading || !!busy || done} aria-busy={busy==='complete'} aria-label="Complete mission">
                  {done ? '✔️ Done' : (busy==='complete' ? 'Completing…' : 'Complete')}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content side="top" style={{ background: 'var(--qic-primary)', color: 'white', padding: '4px 8px', borderRadius: 6 }}>
                Mark as complete
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
          {mission.ai_rationale ? (
            <Popover.Root>
              <Popover.Trigger asChild>
                <button aria-label="Why this mission?" style={{ fontSize: 12, background: 'transparent', border: '1px solid var(--qic-border)', padding: '4px 6px', borderRadius: 6 }}>
                  AI rationale
                </button>
              </Popover.Trigger>
              <Popover.Content side="left" style={{ background: 'white', border: '1px solid var(--qic-border)', borderRadius: 8, padding: 10, maxWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <div style={{ fontSize: 12 }}>{mission.ai_rationale}</div>
              </Popover.Content>
            </Popover.Root>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}


