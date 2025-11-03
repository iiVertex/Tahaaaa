import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { RouletteOption } from '@/data/rouletteOptions';

interface RouletteWheelProps {
  options: RouletteOption[]; // Exactly 3 options
  spinning: boolean;
  selectedOptionId?: string | null; // The winning option ID from API
  onSpinComplete: () => void;
}

export default function RouletteWheel({ options, spinning, selectedOptionId, onSpinComplete }: RouletteWheelProps) {
  const rotation = useMotionValue(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const segments = options.length; // Should be 3

  useEffect(() => {
    if (spinning && !isAnimating) {
      setIsAnimating(true);
      
      // Calculate rotation
      // Multiple full spins + rotation to selected segment
      const spins = 5 + Math.random() * 3; // 5-8 full rotations
      const segmentAngle = 360 / segments;
      
      // Find selected option index
      let selectedIndex = 0;
      if (selectedOptionId) {
        const index = options.findIndex(opt => opt.id === selectedOptionId);
        if (index >= 0) {
          selectedIndex = index;
        } else {
          // Fallback to random if ID not found
          selectedIndex = Math.floor(Math.random() * segments);
        }
      } else {
        // If no selectedOptionId yet (API call in progress), pick random segment
        // The visual result will be shown in the result display below
        selectedIndex = Math.floor(Math.random() * segments);
      }
      
      // Calculate final rotation to align selected segment with pointer (at 0 degrees)
      // Pointer is at top, so we need to rotate to put the selected segment at the top
      // Each segment occupies 360/segments degrees
      // We want the center of the selected segment to align with the pointer
      const segmentCenter = selectedIndex * segmentAngle + segmentAngle / 2;
      // Rotate so segment center aligns with top (0 degrees)
      // Since pointer is at top, we rotate backwards to bring segment to top
      const finalRotation = spins * 360 + (360 - segmentCenter);

      // Animate rotation
      animate(rotation, finalRotation, {
        duration: 3,
        ease: [0.17, 0.67, 0.83, 0.67], // Ease out for natural deceleration
        onComplete: () => {
          setIsAnimating(false);
          onSpinComplete();
        }
      });
    }
  }, [spinning, segments, options]); // Removed selectedOptionId from deps to avoid re-triggering


  const rotate = useTransform(rotation, (latest) => `${latest}deg`);

  return (
    <div style={{ 
      position: 'relative', 
      width: 300, 
      height: 300, 
      margin: '20px auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Pointer/Indicator at top */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '15px solid transparent',
        borderRight: '15px solid transparent',
        borderTop: '30px solid #FFD700',
        zIndex: 10,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
      }} />

      {/* Spinning Wheel */}
      <motion.div
        style={{
          width: 300,
          height: 300,
          borderRadius: '50%',
          position: 'relative',
          border: '8px solid #FFD700',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          rotate: rotate,
          cursor: spinning ? 'not-allowed' : 'pointer',
          overflow: 'hidden'
        }}
      >
        {/* Wheel Segments */}
        {options.map((option, index) => {
          const angle = (360 / segments) * index;
          
          return (
            <div
              key={option.id}
              style={{
                position: 'absolute',
                width: '50%',
                height: '50%',
                left: '50%',
                top: '50%',
                transformOrigin: '0 0',
                transform: `rotate(${angle}deg)`,
                clipPath: `polygon(0 0, 100% 0, 50% 100%)`,
                background: option.color,
                borderRight: '2px solid rgba(255,255,255,0.3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: 20,
                fontSize: 18,
                fontWeight: 700,
                color: 'white',
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{option.icon}</div>
              <div style={{ 
                fontSize: 11, 
                padding: '0 8px',
                textAlign: 'center',
                lineHeight: 1.2,
                transform: 'rotate(60deg)', // Counter-rotate text to be readable
                transformOrigin: 'center'
              }}>
                {option.title.split(' ').slice(0, 2).join(' ')}
              </div>
            </div>
          );
        })}

        {/* Center Circle */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: '#FFD700',
          border: '4px solid white',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: '#111',
          zIndex: 5
        }}>
          🦅
        </div>
      </motion.div>

      {/* Glow effect when spinning */}
      {spinning && (
        <motion.div
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: -1
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
    </div>
  );
}

