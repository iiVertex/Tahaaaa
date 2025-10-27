import React from 'react';

export function LineSkeleton({ width = '100%', height = 12 }:{ width?: string|number; height?: number }) {
  return <div style={{ width, height, background: '#E6E8EE', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

export function CardSkeleton() {
  return (
    <div className="qic-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <LineSkeleton width="60%" />
      <LineSkeleton width="90%" />
      <LineSkeleton width="40%" />
    </div>
  );
}


