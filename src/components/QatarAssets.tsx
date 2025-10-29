import React from 'react';

type IconProps = { size?: number; color?: string; className?: string };

export function DallahIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 18c0-4 3-6 6-6s6 2 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 8c.5-2 2-3 3-3s2.5 1 3 3c.4 1.3 1.2 2.2 2.2 2.8.5.3.8.9.8 1.5v0" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 18h8c0 2.2-1.8 4-4 4s-4-1.8-4-4z" stroke={color} strokeWidth="1.6" />
      <path d="M12 5c0-1 .5-2 1.5-2.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DatePalmIcon({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2c2 1 3 2 3 3 0 0-2-1-3-1s-3 1-3 1c0-1 1-2 3-3z" fill={color} />
      <path d="M12 22V8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 9c2-2 5-2 7-1m7 1c-2-2-5-2-7-1M6 12c2-1.4 5-1.4 6-.8M18 12c-2-1.4-5-1.4-6-.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IslamicStarPattern({ size = 24, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2l2.2 4.5L19 8l-4.8 1.5L12 14l-2.2-4.5L5 8l4.8-1.5L12 2z" stroke={color} strokeWidth="1.4" fill="none" />
      <path d="M12 6l1.2 2.4L16 9l-2.8.9L12 13l-1.2-3.1L8 9l2.8-.6L12 6z" stroke={color} strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export default { DallahIcon, DatePalmIcon, IslamicStarPattern };


