import React from 'react';
import { motion } from 'framer-motion';
import { countUpVariants } from '@/lib/animations';

export default function LifeScoreRing({ value = 0, size = 120, trend = 'flat', level }: { value?: number; size?: number; trend?: 'up'|'down'|'flat'; level?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const dash = (progress / 100) * circumference;
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-label={`LifeScore ${value}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} stroke="#E6E8EE" strokeWidth={10} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke="url(#lsGradient)" strokeWidth={10} fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} />
        {typeof level === 'number' && (
          <circle cx={size/2} cy={size/2} r={radius + 8} stroke="var(--qic-border)" strokeWidth={2} fill="none" />
        )}
        <defs>
          <linearGradient id="lsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--qic-primary)" />
            <stop offset="100%" stopColor="var(--qic-accent)" />
          </linearGradient>
        </defs>
      </svg>
      <motion.div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700 }}
                  variants={countUpVariants} initial="initial" animate="animate">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Math.round(progress)}
          <span aria-hidden style={{ fontSize: 14, color: trend === 'up' ? 'green' : trend === 'down' ? 'crimson' : 'gray' }}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        </div>
      </motion.div>
    </div>
  );
}


