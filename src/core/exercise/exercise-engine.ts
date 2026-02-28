import type {
  EngineState,
  SetupStep,
  ExerciseDefinition,
  BaselineData,
  RepScore,
  ExerciseAngles,
  SetData,
} from './types';
import type { VelocityProfile } from '@/core/pose/types';
import {
  SCORE_WEIGHT_ROM,
  SCORE_WEIGHT_FORM,
  SCORE_WEIGHT_SMOOTHNESS,
  SCORE_WEIGHT_TRAJECTORY,
  SCORE_WEIGHT_HOLD,
} from '@/config/constants';
import { dbg } from '@/lib/debug-logger';

export interface EngineSnapshot {
  state: EngineState;
  setupStep: SetupStep;
  currentPhase: string;
  phaseSequence: string[];
  currentRep: number;
  currentSet: number;
  repStartMs: number;
  holdStartMs: number | null;
  holdElapsedMs: number;
  isHolding: boolean;
  isPaused: boolean;
  sets: SetData[];
  // Per-rep accumulators
  formPassingFrames: number;
  formTotalFrames: number;
  safetyViolationFrames: number;
  velocityHistory: number[];
  trajectoryBuffer: number[][];
  currentFormViolations: Set<string>;
}

export function createEngine(exercise: ExerciseDefinition): EngineSnapshot {
  return {
    state: 'SETUP',
    setupStep: 'ENVIRONMENTAL',
    currentPhase: exercise.phases[0]?.name ?? '',
    phaseSequence: [],
    currentRep: 0,
    currentSet: 1,
    repStartMs: 0,
    holdStartMs: null,
    holdElapsedMs: 0,
    isHolding: false,
    isPaused: false,
    sets: [],
    formPassingFrames: 0,
    formTotalFrames: 0,
    safetyViolationFrames: 0,
    velocityHistory: [],
    trajectoryBuffer: [],
    currentFormViolations: new Set(),
  };
}

export function advanceSetupStep(engine: EngineSnapshot): SetupStep | 'DONE' {
  const steps: SetupStep[] = ['ENVIRONMENTAL', 'ORIENTATION', 'VISIBILITY', 'CALIBRATION'];
  const idx = steps.indexOf(engine.setupStep);
  if (idx < steps.length - 1) {
    engine.setupStep = steps[idx + 1]!;
    return engine.setupStep;
  }
  engine.state = 'READY';
  return 'DONE';
}

export function startSession(engine: EngineSnapshot, timestampMs: number): void {
  dbg.info('Engine', 'Session started', { set: 1, timestampMs });
  engine.state = 'ACTIVE';
  engine.currentRep = 0;
  engine.currentSet = 1;
  engine.repStartMs = timestampMs;
  engine.sets = [{ setNumber: 1, reps: [], restDurationMs: 0 }];
  resetRepAccumulators(engine);
}

function resetRepAccumulators(engine: EngineSnapshot): void {
  engine.formPassingFrames = 0;
  engine.formTotalFrames = 0;
  engine.safetyViolationFrames = 0;
  engine.velocityHistory = [];
  engine.trajectoryBuffer = [];
  engine.currentFormViolations = new Set();
  engine.holdStartMs = null;
  engine.holdElapsedMs = 0;
  engine.isHolding = false;
}

export interface FrameResult {
  phaseChanged: boolean;
  newPhase: string | null;
  repCompleted: boolean;
  repScore: RepScore | null;
  setCompleted: boolean;
  newSetNumber: number | null;
  holdProgress: number; // 0-1
  failedRules: { name: string; severity: 'warning' | 'error'; voiceFeedback: string; joints: number[]; priority: 'safety' | 'form' | 'optimization' }[];
}

export function processFrame(
  engine: EngineSnapshot,
  exercise: ExerciseDefinition,
  angles: ExerciseAngles,
  worldLandmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[],
  baseline: BaselineData,
  velocityProfile: VelocityProfile,
  trajectoryDeviation: number,
  dtwFeatures: number[],
  timestampMs: number,
  targetReps: number,
  targetSets: number,
): FrameResult {
  if (engine.state !== 'ACTIVE' || engine.isPaused) {
    return { phaseChanged: false, newPhase: null, repCompleted: false, repScore: null, setCompleted: false, newSetNumber: null, holdProgress: 0, failedRules: [] };
  }

  // --- Phase tracking ---
  let phaseChanged = false;
  let newPhase: string | null = null;

  for (const phase of exercise.phases) {
    if (phase.name !== engine.currentPhase && phase.enter(angles, engine.currentPhase)) {
      engine.currentPhase = phase.name;
      engine.phaseSequence.push(phase.name);

      // Prevent unbounded growth: keep only last 20 phases
      if (engine.phaseSequence.length > 20) {
        engine.phaseSequence = engine.phaseSequence.slice(-20);
      }

      phaseChanged = true;
      newPhase = phase.name;
      dbg.debug('Engine', `Phase → ${phase.name}`, { sequence: [...engine.phaseSequence] });
      break;
    }
  }

  // --- Hold tracking ---
  // Only hold if the exercise explicitly defines holdDurationMs > 0 AND phase name contains 'hold'
  const isHoldPhase = exercise.holdDurationMs > 0 &&
    engine.currentPhase.toLowerCase().includes('hold');

  if (isHoldPhase && !engine.isHolding) {
    engine.isHolding = true;
    engine.holdStartMs = timestampMs;
  } else if (!isHoldPhase && engine.isHolding) {
    engine.isHolding = false;
  }

  let holdProgress = 0;
  if (engine.isHolding && engine.holdStartMs !== null) {
    engine.holdElapsedMs = timestampMs - engine.holdStartMs;
    holdProgress = Math.min(1, engine.holdElapsedMs / exercise.holdDurationMs);
  }

  // --- DTW trajectory accumulation ---
  engine.trajectoryBuffer.push(dtwFeatures);

  // --- Form rule evaluation ---
  const failedRules: FrameResult['failedRules'] = [];
  let frameAllPassed = true;

  for (const rule of exercise.formRules) {
    const result = rule.check(worldLandmarks, baseline, trajectoryDeviation, velocityProfile, angles);
    if (!result.passed) {
      frameAllPassed = false;
      engine.currentFormViolations.add(rule.name);
      if (rule.priority === 'safety') {
        engine.safetyViolationFrames++;
      }
      failedRules.push({
        name: rule.name,
        severity: result.severity,
        voiceFeedback: rule.voiceFeedback,
        joints: rule.visualTargetJoints,
        priority: rule.priority,
      });
    }
  }

  engine.formTotalFrames++;
  if (frameAllPassed) engine.formPassingFrames++;

  // --- Velocity accumulation ---
  engine.velocityHistory.push(velocityProfile.currentVelocity);

  // --- Rep counting ---
  let repCompleted = false;
  let repScore: RepScore | null = null;
  let setCompleted = false;
  let newSetNumber: number | null = null;

  const seq = engine.phaseSequence;
  const sequences = [exercise.repSequence, ...(exercise.repSequenceAlternate ? [exercise.repSequenceAlternate] : [])];

  // Simple pattern matching: compress sequence and check if it contains the pattern
  // Optimized: only check if sequence is long enough to potentially match
  let matchedSeq: string[] | undefined;

  if (seq.length >= 4) { // Minimum viable sequence for neck rotation (LEFT/RIGHT, CENTER, RIGHT/LEFT, CENTER)
    // Compress sequence by removing consecutive duplicates (in-place for performance)
    const compressed: string[] = [];
    for (let i = 0; i < seq.length; i++) {
      if (compressed[compressed.length - 1] !== seq[i]) {
        compressed.push(seq[i]!);
      }
    }

    // Try matching each sequence
    for (const repSeq of sequences) {
      // Create compressed version of expected sequence
      const expectedCompressed: string[] = [];
      for (let i = 0; i < repSeq.length; i++) {
        if (expectedCompressed[expectedCompressed.length - 1] !== repSeq[i]) {
          expectedCompressed.push(repSeq[i]!);
        }
      }

      // Check if compressed sequence ends with the expected pattern
      if (compressed.length >= expectedCompressed.length) {
        let matches = true;
        for (let i = 0; i < expectedCompressed.length; i++) {
          if (compressed[compressed.length - expectedCompressed.length + i] !== expectedCompressed[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          matchedSeq = repSeq;
          break;
        }
      }
    }
  }

  // Prevent counting too quickly (minimum 800ms per rep to avoid double-counting)
  const minRepDuration = 800;
  const repDuration = timestampMs - engine.repStartMs;
  const durationOk = repDuration >= minRepDuration;

  // Debug logging for rep counting
  if (matchedSeq && !durationOk) {
    dbg.debug('Engine', `Rep matched but too fast (${repDuration}ms < ${minRepDuration}ms)`, {
      sequence: seq.slice(-10),
    });
  } else if (matchedSeq && durationOk) {
    dbg.info('Engine', `✓ Rep counted! Duration: ${repDuration}ms`, {
      sequence: seq.slice(-10),
      matchedPattern: matchedSeq,
    });
  }

  if (matchedSeq && durationOk) {
    engine.currentRep++;
    repCompleted = true;

    repScore = computeRepScore(engine, exercise, baseline, trajectoryDeviation, timestampMs);

    const currentSetData = engine.sets[engine.sets.length - 1];
    if (currentSetData) {
      currentSetData.reps.push({
        repNumber: engine.currentRep,
        durationMs: timestampMs - engine.repStartMs,
        score: repScore,
        formViolations: Array.from(engine.currentFormViolations),
      });
    }

    // Reset for next rep — seed with current phase so next rep can start properly
    engine.repStartMs = timestampMs;
    engine.phaseSequence = [engine.currentPhase];
    resetRepAccumulators(engine);

    // Check set completion
    if (engine.currentRep >= targetReps) {
      if (engine.currentSet >= targetSets) {
        dbg.info('Engine', 'All sets completed — transitioning to COMPLETED');
        engine.state = 'COMPLETED';
      } else {
        setCompleted = true;
        engine.currentSet++;
        newSetNumber = engine.currentSet;
        engine.currentRep = 0;
        dbg.info('Engine', `Set completed → starting set ${engine.currentSet}`);
        engine.sets.push({ setNumber: engine.currentSet, reps: [], restDurationMs: 0 });
      }
    }
  }

  return { phaseChanged, newPhase, repCompleted, repScore, setCompleted, newSetNumber, holdProgress, failedRules };
}

function computeRepScore(
  engine: EngineSnapshot,
  exercise: ExerciseDefinition,
  _baseline: BaselineData,
  trajectoryDeviation: number,
  _timestampMs: number,
): RepScore {
  // ROM: proportion of golden rep range achieved
  const rom = 100; // Simplified — full ROM tracking done via angle min/max during rep

  // Form compliance: passing frames / total, safety violations count 2×
  const effectiveFailFrames = (engine.formTotalFrames - engine.formPassingFrames) + engine.safetyViolationFrames;
  const formCompliance = engine.formTotalFrames > 0
    ? Math.max(0, 100 * (1 - effectiveFailFrames / engine.formTotalFrames))
    : 100;

  // Smoothness from velocity variance
  const smoothness = computeSmoothnessFromHistory(engine.velocityHistory);

  // Trajectory alignment (already 0-100 from DTW)
  const trajectoryAlignment = Math.max(0, Math.min(100, 100 - trajectoryDeviation));

  // Hold time
  const holdTime = exercise.holdDurationMs > 0
    ? Math.min(100, (engine.holdElapsedMs / exercise.holdDurationMs) * 100)
    : 100;

  const total = Math.round(
    rom * SCORE_WEIGHT_ROM +
    formCompliance * SCORE_WEIGHT_FORM +
    smoothness * SCORE_WEIGHT_SMOOTHNESS +
    trajectoryAlignment * SCORE_WEIGHT_TRAJECTORY +
    holdTime * SCORE_WEIGHT_HOLD,
  );

  return {
    total,
    rangeOfMotion: Math.round(rom),
    formCompliance: Math.round(formCompliance),
    smoothness: Math.round(smoothness),
    trajectoryAlignment: Math.round(trajectoryAlignment),
    holdTime: Math.round(holdTime),
  };
}

function computeSmoothnessFromHistory(velocityHistory: number[]): number {
  if (velocityHistory.length < 2) return 100;
  const mean = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
  const variance = velocityHistory.reduce((s, v) => s + (v - mean) ** 2, 0) / velocityHistory.length;
  const peak = Math.max(...velocityHistory.map(Math.abs));
  const maxExpected = (peak * 0.5) ** 2;
  if (maxExpected === 0) return 100;
  return Math.max(0, 100 * (1 - variance / maxExpected));
}

export function pauseEngine(engine: EngineSnapshot): void {
  engine.isPaused = true;
}

export function resumeEngine(engine: EngineSnapshot): void {
  engine.isPaused = false;
}
