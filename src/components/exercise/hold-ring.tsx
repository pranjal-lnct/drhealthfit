'use client';

import { useExerciseStore } from '@/stores/exercise-store';

export function HoldRing() {
  const holdProgress = useExerciseStore((s) => s.holdProgress);

  if (holdProgress <= 0) return null;

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - holdProgress);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg width="200" height="200" className="drop-shadow-lg">
        {/* Background circle */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={holdProgress >= 1 ? '#22c55e' : '#3b82f6'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          className={holdProgress >= 1 ? 'animate-pulse' : ''}
        />
        {/* Center text */}
        <text
          x="100" y="108"
          textAnchor="middle"
          fill="white"
          fontSize="24"
          fontWeight="bold"
        >
          {holdProgress >= 1 ? '✓' : 'Hold'}
        </text>
      </svg>
    </div>
  );
}
