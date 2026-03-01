import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { ExerciseDefinition, ExerciseAngles } from '@/core/exercise/types';
import { LANDMARK } from '@/core/pose/landmarks';

// --- Phase thresholds (see PRD Section 10.1) ---
const CENTER_THRESHOLD = 10;         // must return within 10° to be "centered"
const ROTATION_EXIT_THRESHOLD = 10;  // can exit rotation when within 10° of center
const ROTATION_ENTRY_THRESHOLD = 20; // must reach 20° to count as a rotation (increased from 14 for stability)
const SHOULDER_TILT_THRESHOLD = 0.20;
const MAX_ROTATION_VELOCITY = 120;
const HYPERMOBILITY_ABSOLUTE = 95;
const HYPERMOBILITY_MARGIN = 10;
const LAST_VALID_EXPIRY_MS = 200;

// Cache type for storing last valid angles (passed from session hook to avoid module-level state)
export interface NeckRotationCache {
  angles: ExerciseAngles;
  timestamp: number;
}

function computeNeckAngles(world: NormalizedLandmark[], cache?: unknown): ExerciseAngles {
  const c = cache as NeckRotationCache | undefined;
  const now = performance.now();
  const nose = world[LANDMARK.NOSE];
  const leftEar = world[LANDMARK.LEFT_EAR];
  const rightEar = world[LANDMARK.RIGHT_EAR];
  const leftEyeInner = world[LANDMARK.LEFT_EYE_INNER];
  const rightEyeInner = world[LANDMARK.RIGHT_EYE_INNER];
  const leftShoulder = world[LANDMARK.LEFT_SHOULDER];
  const rightShoulder = world[LANDMARK.RIGHT_SHOULDER];

  const defaultAngles: ExerciseAngles = { rotationAngle: 0, shoulderTilt: 0, trunkRotationDelta: 0, absRotation: 0 };

  if (!leftShoulder || !rightShoulder) {
    return c && (now - c.timestamp < LAST_VALID_EXPIRY_MS) ? c.angles : defaultAngles;
  }

  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  if (shoulderWidth < 0.01) return c ? c.angles : defaultAngles;

  const headPoints = [nose, leftEar, rightEar, leftEyeInner, rightEyeInner];
  let weightedX = 0;
  let totalWeight = 0;
  for (const pt of headPoints) {
    if (!pt) continue;
    const vis = pt.visibility ?? 0;
    if (vis < 0.15) continue;
    weightedX += pt.x * vis;
    totalWeight += vis;
  }

  if (totalWeight < 0.15) {
    return c && (now - c.timestamp < LAST_VALID_EXPIRY_MS) ? c.angles : defaultAngles;
  }

  const headX = weightedX / totalWeight;
  const normalizedOffset = Math.max(-1, Math.min(1, (headX - shoulderMidX) / (shoulderWidth * 0.5)));
  const rotationAngle = -(Math.asin(normalizedOffset) * (180 / Math.PI));
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
  const trunkRotationDelta = Math.abs(leftShoulder.z - rightShoulder.z);

  const newAngles = { rotationAngle, shoulderTilt, trunkRotationDelta, absRotation: Math.abs(rotationAngle) };

  if (c) { c.angles = newAngles; c.timestamp = now; }

  return newAngles;
}

export const neckRotationExercise: ExerciseDefinition = {
  id: 'neck-rotation',
  name: 'Neck Rotation',
  description: 'Controlled head rotation for cervical spine mobility',
  targetMuscles: 'Sternocleidomastoid, Upper Trapezius',
  requiredOrientation: 'frontal',
  requiredLandmarks: [
    LANDMARK.NOSE,
    LANDMARK.LEFT_EAR,
    LANDMARK.RIGHT_EAR,
    LANDMARK.LEFT_SHOULDER,
    LANDMARK.RIGHT_SHOULDER,
  ],
  phases: [
    {
      name: 'CENTER',
      enter: (angles) => (angles.absRotation ?? 0) < CENTER_THRESHOLD,
      exit: (angles) => (angles.absRotation ?? 0) >= ROTATION_ENTRY_THRESHOLD,
    },
    {
      name: 'LEFT_ROTATION',
      enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) <= -ROTATION_ENTRY_THRESHOLD,
      exit: (angles) => (angles.rotationAngle ?? 0) > -ROTATION_EXIT_THRESHOLD,
    },
    {
      name: 'RIGHT_ROTATION',
      enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) >= ROTATION_ENTRY_THRESHOLD,
      exit: (angles) => (angles.rotationAngle ?? 0) < ROTATION_EXIT_THRESHOLD,
    },
  ],
  // Accept either direction first — left-first or right-first both count as a rep
  repSequence: ['LEFT_ROTATION', 'CENTER', 'RIGHT_ROTATION', 'CENTER'],
  repSequenceAlternate: ['RIGHT_ROTATION', 'CENTER', 'LEFT_ROTATION', 'CENTER'],
  formRules: [
    {
      name: 'shoulder_level',
      check: (_world, _baseline, _td, _vp, angles) => ({
        passed: (angles.shoulderTilt ?? 0) <= SHOULDER_TILT_THRESHOLD,
        severity: 'warning',
      }),
      voiceFeedback: 'Keep your shoulders level',
      visualTargetJoints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      cooldownMs: 10000,
      priority: 'form',
    },
    {
      name: 'trunk_rotation',
      check: () => ({ passed: true, severity: 'warning' as const }),
      voiceFeedback: 'Keep your body facing forward',
      visualTargetJoints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      cooldownMs: 10000,
      priority: 'form',
    },
    {
      name: 'speed_control',
      check: (_world, _baseline, _td, vp) => ({
        passed: Math.abs(vp.currentVelocity) <= MAX_ROTATION_VELOCITY,
        severity: 'warning',
      }),
      voiceFeedback: 'Slower, control the movement',
      visualTargetJoints: [LANDMARK.NOSE],
      cooldownMs: 5000,
      priority: 'form',
    },
    {
      name: 'hypermobility',
      check: (_world, baseline, _td, _vp, angles) => {
        const goldenMax = baseline.goldenRepAngles.rotationAngle?.max ?? 80;
        const absRot = angles.absRotation ?? 0;
        return {
          passed: absRot <= goldenMax + HYPERMOBILITY_MARGIN && absRot <= HYPERMOBILITY_ABSOLUTE,
          severity: 'error',
        };
      },
      voiceFeedback: "That's too far, come back a little",
      visualTargetJoints: [LANDMARK.LEFT_EAR, LANDMARK.RIGHT_EAR],
      cooldownMs: 3000,
      priority: 'safety',
    },
  ],
  ghostPose: {
    [LANDMARK.NOSE]: { x: 0.50, y: 0.18 },
    [LANDMARK.LEFT_SHOULDER]: { x: 0.62, y: 0.32 },
    [LANDMARK.RIGHT_SHOULDER]: { x: 0.38, y: 0.32 },
    [LANDMARK.LEFT_EAR]: { x: 0.58, y: 0.16 },
    [LANDMARK.RIGHT_EAR]: { x: 0.42, y: 0.16 },
    [LANDMARK.LEFT_HIP]: { x: 0.58, y: 0.55 },
    [LANDMARK.RIGHT_HIP]: { x: 0.42, y: 0.55 },
  },
  ghostAlignRedThreshold: 0.15,
  ghostAlignYellowThreshold: 0.08,
  extractDTWFeatures: (angles) => [
    angles.rotationAngle ?? 0,
    angles.shoulderTilt ?? 0,
    angles.trunkRotationDelta ?? 0,
  ],
  dtwDimensions: 3,
  computeAngles: computeNeckAngles,
  holdDurationMs: 1000,
  restBetweenSetsMs: 30000,
  defaultReps: 10,
  defaultSets: 3,
};
