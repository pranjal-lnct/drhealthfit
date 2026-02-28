'use client';

import Link from 'next/link';
import type { ExerciseDefinition } from '@/core/exercise/types';

interface ExerciseCardProps {
  exercise: ExerciseDefinition;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <Link href={`/session/${exercise.id}`}>
      <div className="group border border-zinc-200 rounded-xl p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
        <h3 className="text-xl font-semibold group-hover:text-blue-600 transition-colors">
          {exercise.name}
        </h3>
        <p className="text-zinc-500 mt-2 text-sm">{exercise.description}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
          <span>{exercise.targetMuscles}</span>
          <span>•</span>
          <span>{exercise.defaultReps} reps × {exercise.defaultSets} sets</span>
        </div>
      </div>
    </Link>
  );
}
