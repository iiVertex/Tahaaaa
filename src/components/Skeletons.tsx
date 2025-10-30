import React from 'react';

export function LineSkeleton({ width = '100%', height = 12 }:{ width?: string|number; height?: number }) {
  return <div style={{ width, height, background: '#E6E8EE', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

export function CardSkeleton() {
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg, rgba(68,64,151,0.08) 0%, rgba(255,215,0,0.18) 50%, rgba(68,64,151,0.08) 100%)',
        backgroundSize: '200% 100%',
        transform: 'translateX(-100%)', animation: 'qic-shimmer 1.6s infinite'
      }} />
      <LineSkeleton width="60%" />
      <LineSkeleton width="90%" />
      <LineSkeleton width="40%" />
    </div>
  );
}

export function InsightSkeleton() {
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 6 }}>
      <LineSkeleton width="40%" />
      <LineSkeleton width="80%" />
    </div>
  );
}

export function MissionSkeleton() {
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <LineSkeleton width="50%" />
      <LineSkeleton width="100%" />
      <div style={{ display: 'flex', gap: 8 }}>
        <LineSkeleton width={80} height={20} />
        <LineSkeleton width={100} height={20} />
      </div>
    </div>
  );
}

export function RewardSkeleton() {
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <LineSkeleton width="70%" />
      <LineSkeleton width="50%" />
      <LineSkeleton width="30%" />
    </div>
  );
}
// Shimmer keyframes
const style = document.createElement('style');
style.innerHTML = `@keyframes qic-shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }`;
if (typeof document !== 'undefined' && !document.getElementById('qic-shimmer-style')) {
  style.id = 'qic-shimmer-style';
  document.head.appendChild(style);
}


