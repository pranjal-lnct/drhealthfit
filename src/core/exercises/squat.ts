import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import type { ExerciseDefinition, ExerciseAngles } from '@/core/exercise/types';
import { LANDMARK } from '@/core/pose/landmarks';
import { calculateAngle, angleFromVertical } from '@/core/pose/pose-math';

// --- Phase angle thresholds (see PRD Section 10.2) ---
const STANDING_KNEE_ANGLE = 160;
const STANDING_KNEE_HYSTERESIS = 155;
const DESCENT_VELOCITY_THRESHOLD = -5; // °/s, knee angle decreasing
const ASCENT_VELOCITY_THRESHOLD = 5;   // °/s, knee angle increasing
const BOTTOM_VELOCITY_BAND = 5;        // °/s, stable

// --- Form rule thresholds ---
const KNEE_OVER_TOES_RATIO = 0.10;
const BACK_SHIN_ANGLE_DIFF = 35;
const EXCESSIVE_FORWARD_LEAN = 55;
const MAX_DESCENT_VELOCITY = 180;
const MAX_ASCENT_VELOCITY = 200;
const DEPTH_OVERLOAD_MARGIN = 15;

function getVisibleSide(world: NormalizedLandmark[]): 'left' | 'right' {
  const leftVis = (world[LANDMARK.LEFT_SHOULDER]?.visibility ?? 0) +
    (world[LANDMARK.LEFT_HIP]?.visibility ?? 0) +
    (world[LANDMARK.LEFT_KNEE]?.visibility ?? 0);
  const rightVis = (world[LANDMARK.RIGHT_SHOULDER]?.visibility ?? 0) +
    (world[LANDMARK.RIGHT_HIP]?.visibility ?? 0) +
    (world[LANDMARK.RIGHT_KNEE]?.visibility ?? 0);
  return leftVis > rightVis ? 'left' : 'right';
}

function getSideLandmarks(world: NormalizedLandmark[], side: 'left' | 'right') {
  if (side === 'left') {
    return {
      shoulder: world[LANDMARK.LEFT_SHOULDER]!,
      hip: world[LANDMARK.LEFT_HIP]!,
      knee: world[LANDMARK.LEFT_KNEE]!,
      ankle: world[LANDMARK.LEFT_ANKLE]!,
      footIndex: world[LANDMARK.LEFT_FOOT_INDEX]!,
    };
  }
  return {
    shoulder: world[LANDMARK.RIGHT_SHOULDER]!,
    hip: world[LANDMARK.RIGHT_HIP]!,
    knee: world[LANDMARK.RIGHT_KNEE]!,
    ankle: world[LANDMARK.RIGHT_ANKLE]!,
    footIndex: world[LANDMARK.RIGHT_FOOT_INDEX]!,
  };
}

function computeSquatAngles(world: NormalizedLandmark[]): ExerciseAngles {
  const side = getVisibleSide(world);
  const lm = getSideLandmarks(world, side);

  return {
    kneeAngle: calculateAngle(lm.hip, lm.knee, lm.ankle),
    hipAngle: calculateAngle(lm.shoulder, lm.hip, lm.knee),
    backAngle: angleFromVertical(lm.shoulder, lm.hip),
    shinAngle: angleFromVertical(lm.knee, lm.ankle),
    side: side === 'left' ? 0 : 1,
  };
}

// Track velocity state outside the definition for phase detection
let lastKneeAngle = 180;
let kneeVelocity = 0;

export const squatExercise: ExerciseDefinition = {
  id: 'squat',
  name: 'Squat',
  description: 'Controlled bodyweight squat for lower body rehabilitation',
  targetMuscles: 'Quadriceps, Glutes, Hamstrings',
  requiredOrientation: 'lateral',
  requiredLandmarks: [
    LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER,
    LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP,
    LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE,
    LANDMARK.LEFT_ANKLE, LANDMARK.RIGHT_ANKLE,
  ],
  phases: [
    {
      name: 'STANDING',
      enter: (angles) => (angles.kneeAngle ?? 180) > STANDING_KNEE_ANGLE,
      exit: (angles) => (angles.kneeAngle ?? 180) <= STANDING_KNEE_HYSTERESIS,
    },
    {
      name: 'DESCENT',
      enter: (angles, prev) => {
        const knee = angles.kneeAngle ?? 180;
        kneeVelocity = knee - lastKneeAngle;
        lastKneeAngle = knee;
        return prev === 'STANDING' && knee <= STANDING_KNEE_HYSTERESIS && kneeVelocity < DESCENT_VELOCITY_THRESHOLD;
      },
      exit: (angles) => {
        const knee = angles.kneeAngle ?? 180;
        kneeVelocity = knee - lastKneeAngle;
        lastKneeAngle = knee;
        return kneeVelocity >= 0;
      },
    },
    {
      name: 'BOTTOM_HOLD',
      enter: (angles, prev) => {
        const knee = angles.kneeAngle ?? 180;
        return prev === 'DESCENT' && Math.abs(kneeVelocity) < BOTTOM_VELOCITY_BAND && knee < STANDING_KNEE_HYSTERESIS;
      },
      exit: () => kneeVelocity > ASCENT_VELOCITY_THRESHOLD,
    },
    {
      name: 'ASCENT',
      enter: (_angles, prev) => (prev === 'BOTTOM_HOLD' || prev === 'DESCENT') && kneeVelocity > ASCENT_VELOCITY_THRESHOLD,
      exit: (angles) => (angles.kneeAngle ?? 0) > STANDING_KNEE_ANGLE,
    },
  ],
  repSequence: ['STANDING', 'DESCENT', 'BOTTOM_HOLD', 'ASCENT', 'STANDING'],
  formRules: [
    {
      name: 'knee_over_toes',
      check: (world, _baseline, _td, _vp, angles) => {
        const side = (angles.side ?? 0) === 0 ? 'left' : 'right' as const;
        const lm = getSideLandmarks(world, side);
        const shinLen = Math.abs(lm.knee.x - lm.ankle.x) + Math.abs(lm.knee.y - lm.ankle.y);
        const overshoot = lm.knee.x - lm.footIndex.x;
        return { passed: overshoot <= shinLen * KNEE_OVER_TOES_RATIO, severity: 'warning' };
      },
      voiceFeedback: 'Keep your knees behind your toes',
      visualTargetJoints: [LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
      cooldownMs: 4000,
      priority: 'form',
    },
    {
      name: 'back_angle',
      check: (_world, _baseline, _td, _vp, angles) => {
        const diff = Math.abs((angles.backAngle ?? 0) - (angles.shinAngle ?? 0));
        return { passed: diff <= BACK_SHIN_ANGLE_DIFF, severity: 'warning' };
      },
      voiceFeedback: 'Keep your back more upright',
      visualTargetJoints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      cooldownMs: 4000,
      priority: 'form',
    },
    {
      name: 'excessive_forward_lean',
      check: (_world, _baseline, _td, _vp, angles) => ({
        passed: Math.abs(angles.backAngle ?? 0) <= EXCESSIVE_FORWARD_LEAN,
        severity: 'error',
      }),
      voiceFeedback: 'Straighten your back',
      visualTargetJoints: [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
      cooldownMs: 3000,
      priority: 'safety',
    },
    {
      name: 'controlled_descent',
      check: (_world, _baseline, _td, vp) => ({
        passed: Math.abs(vp.currentVelocity) <= MAX_DESCENT_VELOCITY,
        severity: 'warning',
      }),
      voiceFeedback: 'Slower, control the movement down',
      visualTargetJoints: [LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
      cooldownMs: 5000,
      priority: 'form',
    },
    {
      name: 'controlled_ascent',
      check: (_world, _baseline, _td, vp) => ({
        passed: Math.abs(vp.currentVelocity) <= MAX_ASCENT_VELOCITY,
        severity: 'warning',
      }),
      voiceFeedback: 'Come up slowly and controlled',
      visualTargetJoints: [LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
      cooldownMs: 5000,
      priority: 'form',
    },
    {
      name: 'depth_overload',
      check: (_world, baseline, _td, _vp, angles) => {
        const goldenMin = baseline.goldenRepAngles.kneeAngle?.min ?? 90;
        return {
          passed: (angles.kneeAngle ?? 180) >= goldenMin - DEPTH_OVERLOAD_MARGIN,
          severity: 'error',
        };
      },
      voiceFeedback: "That's deep enough, come back up",
      visualTargetJoints: [LANDMARK.LEFT_KNEE, LANDMARK.RIGHT_KNEE],
      cooldownMs: 3000,
      priority: 'safety',
    },
  ],
  ghostPose: {
    [LANDMARK.LEFT_SHOULDER]: { x: 0.45, y: 0.25 },
    [LANDMARK.LEFT_HIP]: { x: 0.48, y: 0.50 },
    [LANDMARK.LEFT_KNEE]: { x: 0.50, y: 0.72 },
    [LANDMARK.LEFT_ANKLE]: { x: 0.50, y: 0.92 },
    [LANDMARK.LEFT_FOOT_INDEX]: { x: 0.55, y: 0.95 },
  },
  ghostAlignRedThreshold: 0.20,
  ghostAlignYellowThreshold: 0.10,
  extractDTWFeatures: (angles) => [
    angles.kneeAngle ?? 0,
    angles.hipAngle ?? 0,
    angles.backAngle ?? 0,
    angles.shinAngle ?? 0,
  ],
  dtwDimensions: 4,
  computeAngles: computeSquatAngles,
  holdDurationMs: 500,
  restBetweenSetsMs: 45000,
  defaultReps: 10,
  defaultSets: 3,
};
