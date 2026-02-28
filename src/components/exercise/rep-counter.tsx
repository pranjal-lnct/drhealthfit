'use client';

import { useExerciseStore } from '@/stores/exercise-store';

export function RepCounter() {
  const rep = useExerciseStore((s) => s.currentRep);
  const lastScore = useExerciseStore((s) => s.lastRepScore);

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none">
      <div
        key={rep}
        className="text-7xl font-black text-white drop-shadow-lg animate-pulse"
      >
        {rep}
      </div>
      {lastScore && (
        <div className="text-center text-lg text-white/80 mt-1">
          Score: {lastScore.total}
        </div>
      )}
    </div>
  );
}
