import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import {
  VELOCITY_LOOKBACK_FRAMES,
  JERK_THRESHOLD_DEG_S2,
  BONE_RATIO_DEVIATION_THRESHOLD,
  DTW_WINDOW_RATIO,
  DTW_MAX_ANGLE_DIFF,
} from '@/config/constants';
import type { BoneLengthRatios, VelocityFrame, VelocityProfile } from './types';
import { distance3D } from './pose-math';
import { LANDMARK } from './landmarks';

// --- Timestamp-Normalized Velocity (see PRD Section 11.3) ---

export function computeVelocity(
  buffer: VelocityFrame[],
): VelocityProfile {
  if (buffer.length < VELOCITY_LOOKBACK_FRAMES + 1) {
    return { currentVelocity: 0, currentAcceleration: 0, isJerky: false };
  }

  const current = buffer[buffer.length - 1]!;
  const lookback = buffer[buffer.length - 1 - VELOCITY_LOOKBACK_FRAMES]!;
  const dtMs = current.timestampMs - lookback.timestampMs;

  if (dtMs <= 0) {
    return { currentVelocity: 0, currentAcceleration: 0, isJerky: false };
  }

  // °/s — timestamp-normalized, immune to FPS drops
  const velocity = ((current.angleDeg - lookback.angleDeg) / dtMs) * 1000;

  // Acceleration from last 3 frames
  let acceleration = 0;
  if (buffer.length >= 4) {
    const prev3 = buffer[buffer.length - 4]!;
    const prev1 = buffer[buffer.length - 2]!;
    const dt2 = (current.timestampMs - prev3.timestampMs) / 1000;
    if (dt2 > 0) {
      const velPrev = ((prev1.angleDeg - prev3.angleDeg) / (prev1.timestampMs - prev3.timestampMs)) * 1000;
      acceleration = (velocity - velPrev) / dt2;
    }
  }

  return {
    currentVelocity: velocity,
    currentAcceleration: acceleration,
    isJerky: Math.abs(acceleration) > JERK_THRESHOLD_DEG_S2,
  };
}

export function computeSmoothnessScore(velocityHistory: number[]): number {
  if (velocityHistory.length < 2) return 100;

  const mean = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
  const variance = velocityHistory.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocityHistory.length;
  const peak = Math.max(...velocityHistory.map(Math.abs));
  const maxExpectedVariance = (peak * 0.5) ** 2;

  if (maxExpectedVariance === 0) return 100;
  return Math.max(0, 100 * (1 - variance / maxExpectedVariance));
}

// --- Bone Length Ratios (see PRD Section 11.4) ---

export function computeBoneLengthRatios(world: NormalizedLandmark[]): BoneLengthRatios {
  const lHip = world[LANDMARK.LEFT_HIP]!;
  const lKnee = world[LANDMARK.LEFT_KNEE]!;
  const lAnkle = world[LANDMARK.LEFT_ANKLE]!;
  const lShoulder = world[LANDMARK.LEFT_SHOULDER]!;
  const lElbow = world[LANDMARK.LEFT_ELBOW]!;
  const lWrist = world[LANDMARK.LEFT_WRIST]!;

  const thigh = distance3D(lHip, lKnee);
  const shin = distance3D(lKnee, lAnkle);
  const upperArm = distance3D(lShoulder, lElbow);
  const forearm = distance3D(lElbow, lWrist);
  const torso = distance3D(lShoulder, lHip);

  return {
    thighToShin: shin > 0 ? thigh / shin : 1,
    upperArmToForearm: forearm > 0 ? upperArm / forearm : 1,
    torsoToThigh: thigh > 0 ? torso / thigh : 1,
  };
}

export function isFrameDistorted(
  current: BoneLengthRatios,
  baseline: BoneLengthRatios,
  threshold: number = BONE_RATIO_DEVIATION_THRESHOLD,
): boolean {
  const check = (cur: number, base: number) =>
    Math.abs(cur - base) / Math.max(base, 0.01) > threshold;

  return (
    check(current.thighToShin, baseline.thighToShin) ||
    check(current.upperArmToForearm, baseline.upperArmToForearm) ||
    check(current.torsoToThigh, baseline.torsoToThigh)
  );
}

// --- DTW Trajectory Matching (see PRD Section 11.5) ---
// Sakoe-Chiba banded DTW with angle-difference cost function.

export function computeDTW(
  live: number[][],
  golden: number[][],
): { distance: number; pathLength: number } {
  const n = live.length;
  const m = golden.length;

  if (n === 0 || m === 0) return { distance: 0, pathLength: 0 };

  const w = Math.max(1, Math.ceil(Math.max(n, m) * DTW_WINDOW_RATIO));

  // Cost matrix — use Infinity for out-of-band cells
  const dtw: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  dtw[0]![0] = 0;

  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - w);
    const jEnd = Math.min(m, i + w);
    for (let j = jStart; j <= jEnd; j++) {
      const liveFrame = live[i - 1]!;
      const goldenFrame = golden[j - 1]!;

      // Cost = sum of absolute angle differences across dimensions
      let cost = 0;
      for (let k = 0; k < liveFrame.length; k++) {
        cost += Math.abs((liveFrame[k] ?? 0) - (goldenFrame[k] ?? 0));
      }

      dtw[i]![j] = cost + Math.min(
        dtw[i - 1]![j - 1]!,
        dtw[i - 1]![j]!,
        dtw[i]![j - 1]!,
      );
    }
  }

  // Backtrack to find path length
  let pathLength = 0;
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    pathLength++;
    const diag = dtw[i - 1]?.[j - 1] ?? Infinity;
    const up = dtw[i - 1]?.[j] ?? Infinity;
    const left = dtw[i]?.[j - 1] ?? Infinity;
    const minVal = Math.min(diag, up, left);
    if (minVal === diag) { i--; j--; }
    else if (minVal === up) { i--; }
    else { j--; }
  }

  return { distance: dtw[n]![m]!, pathLength: Math.max(pathLength, 1) };
}

export function computeTrajectoryScore(
  live: number[][],
  golden: number[][],
  dimensions: number,
): number {
  const { distance, pathLength } = computeDTW(live, golden);
  const normalizedDistance = distance / (DTW_MAX_ANGLE_DIFF * dimensions * pathLength);
  return Math.max(0, (1 - normalizedDistance) * 100);
}
