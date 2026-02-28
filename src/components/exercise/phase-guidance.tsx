'use client';

import { memo } from 'react';
import { useExerciseStore } from '@/stores/exercise-store';

const GUIDANCE: Record<string, { text: string; next: string }> = {
  // Neck rotation
  CENTER:         { text: 'Centered',        next: 'Turn BOTH left AND right for 1 rep' },
  LEFT_ROTATION:  { text: 'Good - Hold Left',   next: 'Return to center, then turn RIGHT' },
  RIGHT_ROTATION: { text: 'Good - Hold Right',  next: 'Return to center, then turn LEFT' },
  // Squat
  STANDING:       { text: 'Stand Straight',  next: '↓ Go Down' },
  DESCENT:        { text: '↓ Going Down',    next: 'Hold at bottom' },
  BOTTOM_HOLD:    { text: '⏸ Hold',          next: '↑ Come Up' },
  ASCENT:         { text: '↑ Coming Up',     next: 'Stand up straight' },
};

export const PhaseGuidance = memo(function PhaseGuidance() {
  const phase = useExerciseStore((s) => s.currentPhase);
  const g = GUIDANCE[phase];
  if (!g) return null;

  return (
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center pointer-events-none z-30">
      {/* Current action - large and prominent */}
      <div className="text-5xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] mb-2">
        {g.text}
      </div>
      {/* Next action - smaller and subtle */}
      <div className="text-base text-white/60 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
        {g.next}
      </div>
    </div>
  );
});
