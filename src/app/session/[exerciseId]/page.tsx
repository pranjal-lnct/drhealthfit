'use client';

import { use, useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getExercise } from '@/core/exercise/exercise-registry';
import { useCamera } from '@/hooks/use-camera';
import { useExerciseSession } from '@/hooks/use-exercise-session';
import { useExerciseStore } from '@/stores/exercise-store';
import { usePoseStore } from '@/stores/pose-store';
import { ExerciseViewport } from '@/components/camera/exercise-viewport';
import { ExerciseHUD } from '@/components/exercise/exercise-hud';
import { ExerciseSetup } from '@/components/exercise/exercise-setup';
import { RepCounter } from '@/components/exercise/rep-counter';
import { FormFeedback } from '@/components/exercise/form-feedback';
import { HoldRing } from '@/components/exercise/hold-ring';
import { ExerciseComplete } from '@/components/exercise/exercise-complete';
import { DebugHUD } from '@/components/exercise/debug-hud';
import { NeckRotationGuide } from '@/components/exercise/neck-rotation-guide';
import { PhaseGuidance } from '@/components/exercise/phase-guidance';
import { SessionErrorBoundary } from '@/components/session-error-boundary';

interface PageProps {
  params: Promise<{ exerciseId: string }>;
}

export default function SessionPage({ params }: PageProps) {
  const { exerciseId } = use(params);
  const router = useRouter();
  const exercise = getExercise(exerciseId);

  // Reset stores on mount so stale state from previous sessions is cleared
  useEffect(() => {
    useExerciseStore.getState().reset();
    usePoseStore.getState().reset();
  }, []);

  if (!exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl">Exercise not found</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Back to Exercises
          </button>
        </div>
      </div>
    );
  }

  return (
    <SessionErrorBoundary>
      <SessionContent exerciseId={exerciseId} />
    </SessionErrorBoundary>
  );
}

function SessionContent({ exerciseId }: { exerciseId: string }) {
  const exercise = getExercise(exerciseId)!;
  const { videoRef, error, start } = useCamera();
  const [hasStarted, setHasStarted] = useState(false);
  const engineState = useExerciseStore((s) => s.engineState);

  const { startDetectionLoop } = useExerciseSession(exercise, videoRef);

  const handleStart = useCallback(async () => {
    console.log('[SessionPage] Starting exercise:', exerciseId);
    setHasStarted(true);
    // Wait for next render so video element is in the DOM
    await new Promise((r) => setTimeout(r, 100));
    await start();
    console.log('[SessionPage] Camera started, video readyState:', videoRef.current?.readyState);
    setTimeout(() => startDetectionLoop(), 500);
  }, [start, startDetectionLoop]);

  if (engineState === 'COMPLETED') {
    return <ExerciseComplete exerciseId={exerciseId} />;
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-8">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-3xl font-bold">{exercise.name}</h1>
          <p className="text-zinc-400">{exercise.description}</p>
          <div className="text-sm text-zinc-500">
            {exercise.defaultReps} reps × {exercise.defaultSets} sets
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-sm">
              {error === 'NotAllowedError' && 'Camera permission denied. Please allow camera access in your browser settings.'}
              {error === 'NotFoundError' && 'No camera found. Please connect a camera.'}
              {error === 'NotReadableError' && 'Camera is in use by another app. Please close it and try again.'}
              {error === 'OverconstrainedError' && 'Camera does not support required settings.'}
              {error === 'unknown' && 'An unexpected error occurred.'}
            </div>
          )}

          <button
            onClick={handleStart}
            className="bg-blue-600 hover:bg-blue-500 text-white text-lg py-4 px-8 rounded-xl transition-colors w-full"
          >
            Start Exercise
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <ExerciseViewport exercise={exercise} ref={videoRef}>
        <DebugHUD />
        {engineState === 'SETUP' && <ExerciseSetup />}
        {(engineState === 'ACTIVE' || engineState === 'READY') && (
          <>
            <ExerciseHUD />
            <RepCounter />
            <PhaseGuidance />
            <FormFeedback />
            <HoldRing />
            {exerciseId === 'neck-rotation' && <NeckRotationGuide />}
          </>
        )}
      </ExerciseViewport>
    </div>
  );
}
