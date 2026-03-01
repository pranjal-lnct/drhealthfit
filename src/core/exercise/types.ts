import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { BoneLengthRatios, VelocityProfile } from '@/core/pose/types';
import type { Orientation } from '@/core/pose/pose-math';

// --- Engine States ---

export type EngineState = 'SETUP' | 'READY' | 'ACTIVE' | 'COMPLETED';

export type SetupStep = 'ENVIRONMENTAL' | 'ORIENTATION' | 'VISIBILITY' | 'CALIBRATION';

// --- Exercise Phases ---

export interface PhaseDefinition {
  name: string;
  /** Entry condition: returns true when this phase should activate */
  enter: (angles: ExerciseAngles, prevPhase: string) => boolean;
  /** Exit condition: returns true when this phase should deactivate */
  exit: (angles: ExerciseAngles) => boolean;
}

export interface ExerciseAngles {
  [key: string]: number;
}

// --- Form Rules ---

export type FormSeverity = 'warning' | 'error';
export type FormPriority = 'safety' | 'form' | 'optimization';

export interface FormRuleResult {
  passed: boolean;
  severity: FormSeverity;
}

export interface FormRule {
  name: string;
  check: (
    worldLandmarks: NormalizedLandmark[],
    baseline: BaselineData,
    trajectoryDeviation: number,
    velocityProfile: VelocityProfile,
    angles: ExerciseAngles,
  ) => FormRuleResult;
  voiceFeedback: string;
  visualTargetJoints: number[];
  cooldownMs: number;
  priority: FormPriority;
}

// --- Exercise Definition ---

export interface GhostPose {
  [landmarkIndex: number]: { x: number; y: number };
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  description: string;
  targetMuscles: string;
  requiredOrientation: Orientation;
  requiredLandmarks: number[];
  phases: PhaseDefinition[];
  /** Ordered phase names that constitute one full rep */
  repSequence: string[];
  /** Optional alternate sequence (e.g. starting from opposite direction) */
  repSequenceAlternate?: string[];
  formRules: FormRule[];
  ghostPose: GhostPose;
  /** Ghost alignment threshold as fraction of reference length */
  ghostAlignRedThreshold: number;
  ghostAlignYellowThreshold: number;
  /** DTW feature extractor: returns angle array for one frame */
  extractDTWFeatures: (angles: ExerciseAngles) => number[];
  dtwDimensions: number;
  /** Angle extractor from world landmarks (optional cache for exercises that need it) */
  computeAngles: (world: NormalizedLandmark[], cache?: unknown) => ExerciseAngles;
  holdDurationMs: number;
  restBetweenSetsMs: number;
  defaultReps: number;
  defaultSets: number;
}

// --- Baseline / Calibration ---

export interface BaselineData {
  standingAngles: ExerciseAngles;
  boneLengthRatios: BoneLengthRatios;
  goldenRepTrajectory: number[][];
  goldenRepDurationMs: number;
  goldenRepAngles: { [key: string]: { min: number; max: number } };
}

// --- Rep Score ---

export interface RepScore {
  total: number;
  rangeOfMotion: number;
  formCompliance: number;
  smoothness: number;
  trajectoryAlignment: number;
  holdTime: number;
}

export interface RepData {
  repNumber: number;
  durationMs: number;
  score: RepScore;
  formViolations: string[];
}

// --- Session Data ---

export interface SetData {
  setNumber: number;
  reps: RepData[];
  restDurationMs: number;
}

export interface SessionData {
  exerciseId: string;
  totalDurationMs: number;
  completedSets: number;
  sets: SetData[];
}
