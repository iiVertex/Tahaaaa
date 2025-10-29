import { Variants } from 'framer-motion';

export const countUpVariants: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 180, damping: 20 } },
};

export const cardEntranceVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export const rewardUnlockVariants: Variants = {
  initial: { scale: 0.9 },
  animate: { scale: [1, 1.08, 1], transition: { times: [0, 0.5, 1], duration: 0.5 } },
};

export const pulseVariants: Variants = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 1.4 } },
};

// TODO: Enhance later - confetti burst and particle effects for milestone achievements


