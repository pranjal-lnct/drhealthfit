'use client';

import Link from 'next/link';
import { useExerciseStore } from '@/stores/exercise-store';
import { formatScore } from '@/lib/utils';

interface ExerciseCompleteProps {
  exerciseId: string;
}

export function ExerciseComplete({ exerciseId }: ExerciseCompleteProps) {
  const averageScore = useExerciseStore((s) => s.averageScore);
  const totalReps = useExerciseStore((s) => s.currentRep);
  const sets = useExerciseStore((s) => s.sets);
  const sessionStart = useExerciseStore((s) => s.sessionStartMs);
  const baselineData = useExerciseStore((s) => s.baselineData);

  // eslint-disable-next-line react-hooks/purity
  const duration = performance.now() - sessionStart;

  const handleExport = () => {
    const data = {
      version: '0.1',
      exportedAt: new Date().toISOString(),
      exerciseId,
      session: {
        totalDurationMs: Math.round(duration),
        completedSets: sets.length,
        sets,
      },
      calibration: baselineData ? {
        standingAngles: baselineData.standingAngles,
        boneLengthRatios: baselineData.boneLengthRatios,
        goldenRepDurationMs: baselineData.goldenRepDurationMs,
        goldenRepAngles: baselineData.goldenRepAngles,
      } : null,
      summary: {
        totalReps,
        averageScore: Math.round(averageScore),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drhealthfit-${exerciseId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">Session Complete</h1>

        <div className="bg-zinc-900 rounded-xl p-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-zinc-400">Total Reps</span>
            <span className="font-bold">{totalReps}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Average Score</span>
            <span className="font-bold">{Math.round(averageScore)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Assessment</span>
            <span className="font-bold">{formatScore(averageScore)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Duration</span>
            <span className="font-bold">{Math.round(duration / 1000)}s</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors"
          >
            Export JSON
          </button>
          <Link href="/" className="flex-1">
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-lg transition-colors">
              Back to Exercises
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
