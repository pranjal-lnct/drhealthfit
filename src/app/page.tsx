'use client';

import { getAllExercises } from '@/core/exercise/exercise-registry';
import { ExerciseCard } from '@/components/exercise/exercise-card';

export default function HomePage() {
  const exercises = getAllExercises();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">DrHealthFit</h1>
          <p className="text-zinc-500">AI Physiotherapy Exercise Assistant</p>
        </div>

        <div className="grid gap-4">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>

        <p className="text-center text-xs text-zinc-400">
          Prototype v0.1 — Camera and microphone required
        </p>
      </div>
    </main>
  );
}
