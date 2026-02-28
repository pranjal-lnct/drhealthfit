import { create } from 'zustand';
import type { EngineState, SetupStep, RepScore, SetData, BaselineData, ExerciseAngles } from '@/core/exercise/types';
import type { BoneLengthRatios, VelocityProfile } from '@/core/pose/types';

interface FormFeedback {
  name: string;
  severity: 'warning' | 'error';
  voiceFeedback: string;
  joints: number[];
  timestamp: number;
}

interface DebugMetrics {
  currentAngles: ExerciseAngles;
  velocityProfile: VelocityProfile;
  boneLengthRatios: BoneLengthRatios;
}

interface ExerciseState {
  engineState: EngineState;
  setupStep: SetupStep;
  currentPhase: string;
  currentRep: number;
  currentSet: number;
  targetReps: number;
  targetSets: number;
  lastRepScore: RepScore | null;
  averageScore: number;
  holdProgress: number;
  isResting: boolean;
  restRemainingMs: number;
  activeFeedback: FormFeedback[];
  sets: SetData[];
  sessionStartMs: number;
  baselineData: BaselineData | null;
  debugMetrics: DebugMetrics | null;
  /** Joint indices that currently have errors — for traffic-light coloring */
  errorJoints: Set<number>;
  warningJoints: Set<number>;

  setEngineState: (state: EngineState) => void;
  setSetupStep: (step: SetupStep) => void;
  setPhase: (phase: string) => void;
  completeRep: (rep: number, score: RepScore) => void;
  setHoldProgress: (progress: number) => void;
  setFeedback: (feedback: FormFeedback[]) => void;
  setJointStatus: (errors: number[], warnings: number[]) => void;
  setResting: (resting: boolean, remainingMs: number) => void;
  setSet: (set: number) => void;
  startSession: (targetReps: number, targetSets: number) => void;
  setBaselineData: (baseline: BaselineData) => void;
  setDebugMetrics: (metrics: DebugMetrics) => void;
  reset: () => void;
}

export const useExerciseStore = create<ExerciseState>((set) => ({
  engineState: 'SETUP',
  setupStep: 'ENVIRONMENTAL',
  currentPhase: '',
  currentRep: 0,
  currentSet: 1,
  targetReps: 10,
  targetSets: 3,
  lastRepScore: null,
  averageScore: 0,
  holdProgress: 0,
  isResting: false,
  restRemainingMs: 0,
  activeFeedback: [],
  sets: [],
  sessionStartMs: 0,
  baselineData: null,
  debugMetrics: null,
  errorJoints: new Set(),
  warningJoints: new Set(),

  setEngineState: (state) => set({ engineState: state }),
  setSetupStep: (step) => set({ setupStep: step }),
  setPhase: (phase) => set({ currentPhase: phase }),
  completeRep: (rep, score) =>
    set((s) => ({
      currentRep: rep,
      lastRepScore: score,
      averageScore: s.averageScore > 0 ? (s.averageScore * (rep - 1) + score.total) / rep : score.total,
    })),
  setHoldProgress: (progress) => set({ holdProgress: progress }),
  setFeedback: (feedback) => set({ activeFeedback: feedback }),
  setJointStatus: (errors, warnings) =>
    set({ errorJoints: new Set(errors), warningJoints: new Set(warnings) }),
  setResting: (resting, remainingMs) => set({ isResting: resting, restRemainingMs: remainingMs }),
  setSet: (setNum) => set({ currentSet: setNum, currentRep: 0 }),
  startSession: (targetReps, targetSets) =>
    set({ targetReps, targetSets, sessionStartMs: performance.now(), engineState: 'ACTIVE' }),
  setBaselineData: (baseline) => set({ baselineData: baseline }),
  setDebugMetrics: (metrics) => set({ debugMetrics: metrics }),
  reset: () =>
    set({
      engineState: 'SETUP', setupStep: 'ENVIRONMENTAL', currentPhase: '', currentRep: 0,
      currentSet: 1, lastRepScore: null, averageScore: 0, holdProgress: 0, isResting: false,
      restRemainingMs: 0, activeFeedback: [], sets: [], sessionStartMs: 0, baselineData: null, debugMetrics: null,
      errorJoints: new Set(), warningJoints: new Set(),
    }),
}));
