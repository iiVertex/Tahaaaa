import React from 'react';

export default function LifeScoreRing({ value = 0, size = 120 }: { value?: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const dash = (progress / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-label={`LifeScore ${value}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} stroke="#E6E8EE" strokeWidth={10} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke="var(--qic-primary)" strokeWidth={10} fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700 }}>
        {Math.round(progress)}
      </div>
    </div>
  );
}


