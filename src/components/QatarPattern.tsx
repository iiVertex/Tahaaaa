import React from 'react';

export default function QatarPattern({ variant = 'stars', opacity = 0.4, color }: { variant?: 'stars'|'mosaic'; opacity?: number; color?: string }) {
  const className = variant === 'stars' ? 'qic-pattern-stars' : 'qic-pattern-mosaic';
  return (
    <div aria-hidden className={className} style={{ position: 'absolute', inset: 0, opacity, filter: color ? `drop-shadow(0 0 0 ${color})` : undefined }} />
  );
}


