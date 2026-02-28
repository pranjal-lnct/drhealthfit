import type { ExerciseDefinition } from './types';
import { squatExercise } from '@/core/exercises/squat';
import { neckRotationExercise } from '@/core/exercises/neck-rotation';

const registry = new Map<string, ExerciseDefinition>();

registry.set(squatExercise.id, squatExercise);
registry.set(neckRotationExercise.id, neckRotationExercise);

export function getExercise(id: string): ExerciseDefinition | undefined {
  return registry.get(id);
}

export function getAllExercises(): ExerciseDefinition[] {
  return Array.from(registry.values());
}
