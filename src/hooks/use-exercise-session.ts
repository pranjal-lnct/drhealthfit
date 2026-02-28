import { useRef, useEffect, useCallback } from 'react';

import { initPoseDetector, detectPose, closePoseDetector } from '@/core/pose/pose-detector';
import { createLandmarkFilterBank, filterLandmarks } from '@/core/pose/pose-math';
import { computeBoneLengthRatios, isFrameDistorted, computeVelocity, computeTrajectoryScore } from '@/core/pose/biomechanics';
import {
  createEngine,
  processFrame,
  startSession,
  advanceSetupStep,
  resumeEngine,
} from '@/core/exercise/exercise-engine';
import type { ExerciseDefinition, BaselineData } from '@/core/exercise/types';
import type { VelocityFrame } from '@/core/pose/types';
import { speak } from '@/core/voice/speech-synthesis';
import { usePoseStore } from '@/stores/pose-store';
import { useExerciseStore } from '@/stores/exercise-store';
import { useVoiceStore } from '@/stores/voice-store';
import { vibrate } from '@/lib/utils';
import {
  MIN_VISIBILITY_CONFIDENCE,
  SETUP_HOLD_DURATION_MS,
  BASELINE_CAPTURE_DURATION_MS,
  DTW_TRAJECTORY_SAMPLE_INTERVAL,
  LOW_FPS_THRESHOLD,
  HAPTIC_REP_COMPLETE,
  HAPTIC_SET_COMPLETE,
  HAPTIC_FORM_WARNING,
  HAPTIC_FORM_ERROR,
} from '@/config/constants';
import { detectOrientation } from '@/core/pose/pose-math';
import { LANDMARK } from '@/core/pose/landmarks';
import { dbg } from '@/lib/debug-logger';

export function useExerciseSession(
  exercise: ExerciseDefinition,
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const engineRef = useRef(createEngine(exercise));
  const filterBankRef = useRef(createLandmarkFilterBank());
  const baselineRef = useRef<BaselineData | null>(null);
  const velocityBufferRef = useRef<VelocityFrame[]>([]);
  const goldenTrajectoryRef = useRef<number[][]>([]);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(0);
  const fpsCountRef = useRef(0);
  const currentFpsRef = useRef(30);

  useEffect(() => {
    lastFpsTimeRef.current = performance.now();
  }, []);

  const setupHoldStartRef = useRef<number | null>(null);
  const baselineCaptureStartRef = useRef<number | null>(null);
  const isCapturingGoldenRef = useRef(false);
  const goldenRepStartRef = useRef(0);
  const goldenRepLastPhaseRef = useRef<string>('');
  const goldenRepVoicedPhasesRef = useRef(new Set<string>());
  const cooldownMapRef = useRef(new Map<string, number>());
  const rafIdRef = useRef(0);

  const say = useCallback((text: string, priority: 'INTERRUPT' | 'QUEUE' | 'DROP') => {
    if (useVoiceStore.getState().isEnabled) speak(text, priority);
  }, []);

  const handleSetupFrame = useCallback((
    engine: ReturnType<typeof createEngine>,
    exercise: ExerciseDefinition,
    normalized: import('@mediapipe/tasks-vision').NormalizedLandmark[],
    world: import('@mediapipe/tasks-vision').NormalizedLandmark[],
    now: number,
  ) => {
    const step = engine.setupStep;

    if (step === 'ORIENTATION') {
      const leftShoulder = normalized[LANDMARK.LEFT_SHOULDER];
      const rightShoulder = normalized[LANDMARK.RIGHT_SHOULDER];
      if (!leftShoulder || !rightShoulder) return;

      const orientation = detectOrientation(leftShoulder, rightShoulder);
      if (orientation === exercise.requiredOrientation) {
        if (!setupHoldStartRef.current) {
          setupHoldStartRef.current = now;
          dbg.debug('Setup', 'Orientation matched, hold started', { orientation, required: exercise.requiredOrientation });
        }
        if (now - setupHoldStartRef.current >= SETUP_HOLD_DURATION_MS) {
          advanceSetupStep(engine);
          dbg.info('Setup', `Step advanced → ${engine.setupStep}`);
          useExerciseStore.getState().setSetupStep(engine.setupStep);
          setupHoldStartRef.current = null;
        }
      } else {
        setupHoldStartRef.current = null;
        dbg.debug('Setup', 'Orientation mismatch', { detected: orientation, required: exercise.requiredOrientation });
        if (exercise.requiredOrientation === 'frontal') {
          say('Please face the camera', 'QUEUE');
        } else {
          say('Please turn sideways', 'QUEUE');
        }
      }
    } else if (step === 'VISIBILITY') {
      const allVisible = exercise.requiredLandmarks.every(
        (idx) => (normalized[idx]?.visibility ?? 0) >= MIN_VISIBILITY_CONFIDENCE,
      );
      if (allVisible) {
        if (!setupHoldStartRef.current) {
          setupHoldStartRef.current = now;
          dbg.debug('Setup', 'All landmarks visible, hold started');
        }
        if (now - setupHoldStartRef.current >= SETUP_HOLD_DURATION_MS) {
          advanceSetupStep(engine);
          dbg.info('Setup', `Step advanced → ${engine.setupStep}`);
          useExerciseStore.getState().setSetupStep(engine.setupStep);
          setupHoldStartRef.current = null;
          say('Perfect position', 'QUEUE');
        }
      } else {
        setupHoldStartRef.current = null;
      }
    } else if (step === 'CALIBRATION') {
      if (!baselineCaptureStartRef.current) {
        baselineCaptureStartRef.current = now;
        dbg.info('Setup', 'CALIBRATION started — capturing baseline');
        say('Stand still for a moment', 'QUEUE');
      }

      // Static baseline capture (2s)
      if (!baselineRef.current && now - baselineCaptureStartRef.current >= BASELINE_CAPTURE_DURATION_MS) {
        const angles = exercise.computeAngles(world);
        const boneLengthRatios = computeBoneLengthRatios(world);

        baselineRef.current = {
          standingAngles: angles,
          boneLengthRatios,
          goldenRepTrajectory: [],
          goldenRepDurationMs: 0,
          goldenRepAngles: {},
        };

        useExerciseStore.getState().setBaselineData(baselineRef.current);

        dbg.info('Setup', 'Baseline captured', { standingAngles: angles });
        say("Good. Let's do one practice rep slowly.", 'QUEUE');
        isCapturingGoldenRef.current = true;
        goldenRepStartRef.current = now;
        goldenTrajectoryRef.current = [];
        goldenRepLastPhaseRef.current = '';
        goldenRepVoicedPhasesRef.current.clear();
      }

      // Golden rep capture
      if (isCapturingGoldenRef.current && baselineRef.current) {
        const angles = exercise.computeAngles(world);
        const features = exercise.extractDTWFeatures(angles);

        if (frameCountRef.current % DTW_TRAJECTORY_SAMPLE_INTERVAL === 0) {
          goldenTrajectoryRef.current.push(features);
        }

        // Track min/max angles for golden rep
        for (const [key, value] of Object.entries(angles)) {
          if (!baselineRef.current.goldenRepAngles[key]) {
            baselineRef.current.goldenRepAngles[key] = { min: value, max: value };
          } else {
            const range = baselineRef.current.goldenRepAngles[key];
            range.min = Math.min(range.min, value);
            range.max = Math.max(range.max, value);
          }
        }

        // Phase-specific voice guidance during golden rep
        for (const phase of exercise.phases) {
          if (phase.name !== goldenRepLastPhaseRef.current && phase.enter(angles, goldenRepLastPhaseRef.current)) {
            goldenRepLastPhaseRef.current = phase.name;

            // Only provide voice cues for key phases (avoid over-instructing)
            if (!goldenRepVoicedPhasesRef.current.has(phase.name)) {
              goldenRepVoicedPhasesRef.current.add(phase.name);

              const phaseLower = phase.name.toLowerCase();
              if (phaseLower.includes('descent') || phaseLower.includes('down')) {
                say('Down slowly', 'QUEUE');
              } else if (phaseLower.includes('hold') || phaseLower.includes('bottom')) {
                say('Hold', 'QUEUE');
              } else if (phaseLower.includes('ascent') || phaseLower.includes('up')) {
                say('And up', 'QUEUE');
              } else if (phaseLower.includes('left')) {
                say('Turn left', 'QUEUE');
              } else if (phaseLower.includes('right')) {
                say('Turn right', 'QUEUE');
              }
            }
            break;
          }
        }

        // Detect golden rep completion: returned to starting phase
        const currentAngles = exercise.computeAngles(world);
        const startPhase = exercise.phases[0];
        if (
          goldenTrajectoryRef.current.length > 10 &&
          startPhase &&
          startPhase.enter(currentAngles, goldenRepLastPhaseRef.current)
        ) {
          baselineRef.current.goldenRepTrajectory = goldenTrajectoryRef.current;
          baselineRef.current.goldenRepDurationMs = now - goldenRepStartRef.current;
          isCapturingGoldenRef.current = false;

          useExerciseStore.getState().setBaselineData(baselineRef.current);
          dbg.info('Setup', 'Golden rep captured', { trajectoryLength: goldenTrajectoryRef.current.length, durationMs: baselineRef.current.goldenRepDurationMs });

          say("Great. Let's begin.", 'QUEUE');
          engine.state = 'READY';
          useExerciseStore.getState().setEngineState('READY');

          // Auto-start after brief pause
          setTimeout(() => {
            startSession(engineRef.current, performance.now());
            useExerciseStore.getState().startSession(
              useExerciseStore.getState().targetReps,
              useExerciseStore.getState().targetSets,
            );
          }, 1500);
        }
      }
    }
  }, [say, exercise.requiredOrientation, exercise.requiredLandmarks]);

  const startDetectionLoop = useCallback(async () => {
    console.log('[Session] Starting detection loop — initializing pose detector...');
    await initPoseDetector();
    console.log('[Session] Pose detector ready');

    // Skip ALL setup — go straight to ACTIVE
    const engine = engineRef.current;
    engine.state = 'ACTIVE';
    engine.setupStep = 'CALIBRATION';
    engine.repStartMs = performance.now();
    engine.sets = [{ setNumber: 1, reps: [], restDurationMs: 0 }];
    // Force initial phase to CENTER for neck rotation to ensure proper sequence matching
    engine.currentPhase = 'CENTER';
    engine.phaseSequence = ['CENTER'];
    useExerciseStore.getState().setSetupStep('CALIBRATION');
    useExerciseStore.getState().setEngineState('ACTIVE');
    useExerciseStore.getState().setPhase('CENTER');
    useExerciseStore.getState().startSession(
      useExerciseStore.getState().targetReps,
      useExerciseStore.getState().targetSets,
    );

    // Intro voice
    say(`Starting ${exercise.name}. Turn your head left and right to count reps.`, 'QUEUE');

    // Create a synthetic baseline — will be replaced by real data on first frame
    baselineRef.current = {
      standingAngles: exercise.computeAngles(
        Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 })),
      ),
      boneLengthRatios: { thighToShin: 1, upperArmToForearm: 1, torsoToThigh: 1 },
      goldenRepTrajectory: [],
      goldenRepDurationMs: 3000,
      goldenRepAngles: { rotationAngle: { min: -80, max: 80 } },
    };

    const loop = () => {
      rafIdRef.current = requestAnimationFrame(loop);

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        return;
      }

      const now = performance.now();

      // FPS calculation
      fpsCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        currentFpsRef.current = fpsCountRef.current;
        fpsCountRef.current = 0;
        lastFpsTimeRef.current = now;

        if (currentFpsRef.current < LOW_FPS_THRESHOLD) {
          say('Performance is low. Close other tabs for a better experience.', 'DROP');
        }
      }

      const engine = engineRef.current;

      // --- Pose Detection ---
      const poseResult = detectPose(video, now);
      if (!poseResult || !poseResult.landmarks[0] || !poseResult.worldLandmarks[0]) {
        usePoseStore.getState().setTracking(false);
        return;
      }

      const normalizedLandmarks = poseResult.landmarks[0];
      const rawWorldLandmarks = poseResult.worldLandmarks[0];

      // Check visibility of required landmarks
      const allVisible = exercise.requiredLandmarks.every(
        (idx) => (normalizedLandmarks[idx]?.visibility ?? 0) >= MIN_VISIBILITY_CONFIDENCE,
      );

      if (!allVisible && engine.state === 'ACTIVE') {
        // Don't pause — just skip this frame silently
        usePoseStore.getState().setTracking(false);
      }

      if (engine.isPaused && allVisible) {
        resumeEngine(engine);
      }

      // 1 Euro Filter on world landmarks
      const filteredWorld = filterLandmarks(filterBankRef.current, rawWorldLandmarks, now);

      // Compute bone ratios once per frame (reused for distortion check and debug metrics)
      const currentRatios = computeBoneLengthRatios(filteredWorld);

      // Bone ratio distortion check — update baseline on first real frame
      if (baselineRef.current && baselineRef.current.boneLengthRatios.thighToShin === 1) {
        baselineRef.current.boneLengthRatios = currentRatios;
        baselineRef.current.standingAngles = exercise.computeAngles(filteredWorld);
        dbg.info('Loop', 'Baseline captured from first real frame', baselineRef.current.boneLengthRatios);
      }
      let isDistorted = false;
      if (baselineRef.current) {
        // Use more lenient threshold for neck rotation since head movement doesn't distort body ratios much
        const distortionThreshold = exercise.id === 'neck-rotation' ? 0.35 : undefined;
        isDistorted = isFrameDistorted(currentRatios, baselineRef.current.boneLengthRatios, distortionThreshold);
      }

      // Update pose store
      usePoseStore.getState().setFrame(normalizedLandmarks, filteredWorld, now, currentFpsRef.current, isDistorted);

      // --- SETUP Steps ---
      if (engine.state === 'SETUP') {
        handleSetupFrame(engine, exercise, normalizedLandmarks, filteredWorld, now);
        return;
      }

      // --- ACTIVE: Skip distorted frames ---
      if (engine.state === 'ACTIVE' && isDistorted) {
        return;
      }

      if (engine.state !== 'ACTIVE') {
        return;
      }

      // Compute angles from world landmarks
      const angles = exercise.computeAngles(filteredWorld);

      // Velocity
      const primaryAngle = exercise.extractDTWFeatures(angles)[0] ?? 0;
      velocityBufferRef.current.push({ angleDeg: primaryAngle, timestampMs: now });
      if (velocityBufferRef.current.length > 60) velocityBufferRef.current.shift();
      const velocityProfile = computeVelocity(velocityBufferRef.current);

      // Update debug metrics (throttled to every 3 frames for performance)
      if (frameCountRef.current % 3 === 0) {
        useExerciseStore.getState().setDebugMetrics({
          currentAngles: angles,
          velocityProfile,
          boneLengthRatios: currentRatios,
        });
      }

      // DTW features (sampled)
      frameCountRef.current++;
      const dtwFeatures = exercise.extractDTWFeatures(angles);

      // Trajectory score (only compute if we have sufficient trajectory data)
      let trajectoryDeviation = 0;
      if (baselineRef.current &&
          baselineRef.current.goldenRepTrajectory.length > 0 &&
          engine.trajectoryBuffer.length > 10) {
        trajectoryDeviation = 100 - computeTrajectoryScore(
          engine.trajectoryBuffer,
          baselineRef.current.goldenRepTrajectory,
          exercise.dtwDimensions,
        );
      }

      // Process frame through engine
      const result = processFrame(
        engine, exercise, angles, filteredWorld, baselineRef.current!,
        velocityProfile, trajectoryDeviation, dtwFeatures, now,
        useExerciseStore.getState().targetReps,
        useExerciseStore.getState().targetSets,
      );

      // Update store
      if (result.phaseChanged && result.newPhase) {
        dbg.debug('Phase', result.newPhase, { sequence: engine.phaseSequence.slice(-6) });
        useExerciseStore.getState().setPhase(result.newPhase);
      }

      useExerciseStore.getState().setHoldProgress(result.holdProgress);

      if (result.repCompleted && result.repScore) {
        dbg.info('Engine', `Rep ${engine.currentRep} completed`, result.repScore);
        useExerciseStore.getState().completeRep(engine.currentRep, result.repScore);
        say(`Rep ${engine.currentRep}`, 'QUEUE');
        vibrate(HAPTIC_REP_COMPLETE);
      }

      // Handle set completion
      if (result.setCompleted && result.newSetNumber) {
        dbg.info('Engine', `Set ${result.newSetNumber - 1} completed → starting set ${result.newSetNumber}`);
        useExerciseStore.getState().setSet(result.newSetNumber);
        say(`Set ${result.newSetNumber}`, 'QUEUE');
        vibrate(HAPTIC_SET_COMPLETE);
      }

      // Form feedback with cooldowns
      const errorJoints: number[] = [];
      const warningJoints: number[] = [];

      for (const rule of result.failedRules) {
        const lastFired = cooldownMapRef.current.get(rule.name) ?? 0;
        const cooldown = exercise.formRules.find((r) => r.name === rule.name)?.cooldownMs ?? 4000;

        if (rule.severity === 'error') {
          errorJoints.push(...rule.joints);
        } else {
          warningJoints.push(...rule.joints);
        }

        if (now - lastFired >= cooldown) {
          cooldownMapRef.current.set(rule.name, now);
          const voicePriority = rule.priority === 'safety' ? 'INTERRUPT' : 'QUEUE';
          say(rule.voiceFeedback, voicePriority);
          if (rule.severity === 'error') vibrate(HAPTIC_FORM_ERROR);
          else vibrate(HAPTIC_FORM_WARNING);
        }
      }

      useExerciseStore.getState().setJointStatus(errorJoints, warningJoints);
      useExerciseStore.getState().setFeedback(
        result.failedRules.map((r) => ({
          name: r.name,
          severity: r.severity,
          voiceFeedback: r.voiceFeedback,
          joints: r.joints,
          timestamp: now,
        })),
      );

      if ((engine as { state: string }).state === 'COMPLETED') {
        dbg.info('Engine', 'Session COMPLETED');
        useExerciseStore.getState().setEngineState('COMPLETED');
      }
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [exercise, videoRef, say]);


  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      closePoseDetector();
    };
  }, []);

  return { startDetectionLoop, engineRef, baselineRef };
}
