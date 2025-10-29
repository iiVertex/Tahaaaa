import React, { useMemo, useState } from 'react';

export default function PremiumSimulator() {
  const [current, setCurrent] = useState<number>(50);
  const [target, setTarget] = useState<number>(80);

  const reductionPct = useMemo(() => {
    // Estimate: linear reduction, 0% at 40 → 15% at 80
    const clamped = Math.max(40, Math.min(100, target));
    const pct = ((clamped - 40) / (80 - 40)) * 15; // up to 15%
    return Math.round(pct);
  }, [target]);

  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Premium Delta Simulator</div>
      <div style={{ fontSize: 12, color: 'var(--qic-muted)' }}>Estimate premium change when LifeScore improves.</div>
      <div>
        <label>Current LifeScore: {current}
          <input type="range" min={20} max={100} step={1} value={current} onChange={(e)=> setCurrent(parseInt(e.target.value))} style={{ width: '100%' }} />
        </label>
      </div>
      <div>
        <label>Target LifeScore: {target}
          <input type="range" min={current} max={100} step={1} value={target} onChange={(e)=> setTarget(parseInt(e.target.value))} style={{ width: '100%' }} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 10, background: '#E6E8EE', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${current}%`, height: '100%', background: 'var(--qic-secondary)' }} />
          </div>
          <span style={{ fontSize: 12 }}>Before</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 10, background: '#E6E8EE', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${target}%`, height: '100%', background: 'var(--qic-primary)' }} />
          </div>
          <span style={{ fontSize: 12 }}>After</span>
        </div>
      </div>
      <div>Estimated premium reduction: <b>-{reductionPct}%</b></div>
      <div>
        <button>Apply to My Quote</button>
      </div>
    </div>
  );
}


