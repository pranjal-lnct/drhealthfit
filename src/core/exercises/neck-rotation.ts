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

// Cached zero result to avoid object allocation on every invalid frame
const ZERO_ANGLES: ExerciseAngles = { rotationAngle: 0, shoulderTilt: 0, trunkRotationDelta: 0, absRotation: 0 };

function computeNeckAngles(world: NormalizedLandmark[]): ExerciseAngles {
  const nose = world[LANDMARK.NOSE];
  const leftShoulder = world[LANDMARK.LEFT_SHOULDER];
  const rightShoulder = world[LANDMARK.RIGHT_SHOULDER];

  if (!nose || !leftShoulder || !rightShoulder) return ZERO_ANGLES;
  if ((nose.visibility ?? 0) < 0.3) return ZERO_ANGLES;

  // Use shoulder midpoint as the neutral head center reference.
  // This is stable regardless of head rotation (shoulders don't move during neck rotation).
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  if (shoulderWidth < 0.01) return ZERO_ANGLES; // degenerate frame

  // Nose offset from shoulder center, normalized by half shoulder width
  // Multiply by -1 to match user perspective (turn left = negative angle)
  const noseOffset = nose.x - shoulderMidX;
  const rotationAngle = -(noseOffset / (shoulderWidth * 0.5)) * 90;

  const shoulderTilt = shoulderWidth > 0
    ? Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth
    : 0;

  const trunkRotationDelta = Math.abs(leftShoulder.z - rightShoulder.z);

  return {
    rotationAngle,
    shoulderTilt,
    trunkRotationDelta,
    absRotation: Math.abs(rotationAngle),
  };
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
