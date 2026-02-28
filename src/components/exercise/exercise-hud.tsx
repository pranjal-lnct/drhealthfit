'use client';

import { useExerciseStore } from '@/stores/exercise-store';
import { usePoseStore } from '@/stores/pose-store';
import { formatTime } from '@/lib/utils';

export function ExerciseHUD() {
  const phase = useExerciseStore((s) => s.currentPhase);
  const rep = useExerciseStore((s) => s.currentRep);
  const set = useExerciseStore((s) => s.currentSet);
  const targetReps = useExerciseStore((s) => s.targetReps);
  const targetSets = useExerciseStore((s) => s.targetSets);
  const lastScore = useExerciseStore((s) => s.lastRepScore);
  const sessionStart = useExerciseStore((s) => s.sessionStartMs);
  const fps = usePoseStore((s) => s.fps);

  // eslint-disable-next-line react-hooks/purity
  const elapsed = sessionStart > 0 ? performance.now() - sessionStart : 0;

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
      <div className="bg-black/60 rounded-lg px-4 py-2 text-white space-y-1">
        <div className="text-sm opacity-70">Set {set}/{targetSets}</div>
        <div className="text-3xl font-bold tabular-nums">{rep}/{targetReps}</div>
        <div className="text-sm opacity-70">{formatTime(elapsed)}</div>
      </div>

      <div className="bg-black/60 rounded-lg px-4 py-2 text-white text-right space-y-1">
        <div className="text-sm opacity-70 capitalize">{phase.toLowerCase().replace('_', ' ')}</div>
        {lastScore && (
          <div className="text-2xl font-bold">{lastScore.total}</div>
        )}
        <div className="text-xs opacity-50">{fps} FPS</div>
      </div>
    </div>
  );
}
