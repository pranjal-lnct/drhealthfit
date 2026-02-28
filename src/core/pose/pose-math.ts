import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import {
  ONE_EURO_MIN_CUTOFF,
  ONE_EURO_BETA,
  ONE_EURO_D_CUTOFF,
} from '@/config/constants';

// --- 1 Euro Filter (see PRD Section 11.2) ---
// Adaptive low-pass filter: high smoothing at rest, low smoothing during movement.

interface OneEuroState {
  xPrev: number;
  dxPrev: number;
  tPrev: number;
  initialized: boolean;
}

function alphaFromCutoff(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

function lowPass(x: number, prev: number, alpha: number): number {
  return alpha * x + (1 - alpha) * prev;
}

export function createOneEuroState(): OneEuroState {
  return { xPrev: 0, dxPrev: 0, tPrev: 0, initialized: false };
}

export function filterOneEuro(
  state: OneEuroState,
  x: number,
  timestampMs: number,
): number {
  if (!state.initialized) {
    state.xPrev = x;
    state.dxPrev = 0;
    state.tPrev = timestampMs;
    state.initialized = true;
    return x;
  }

  const dt = Math.max((timestampMs - state.tPrev) / 1000, 0.001); // seconds
  state.tPrev = timestampMs;

  // Derivative estimation
  const dx = (x - state.xPrev) / dt;
  const edx = lowPass(dx, state.dxPrev, alphaFromCutoff(ONE_EURO_D_CUTOFF, dt));
  state.dxPrev = edx;

  // Adaptive cutoff
  const cutoff = ONE_EURO_MIN_CUTOFF + ONE_EURO_BETA * Math.abs(edx);
  const filtered = lowPass(x, state.xPrev, alphaFromCutoff(cutoff, dt));
  state.xPrev = filtered;

  return filtered;
}

// --- Filter Bank for all 33 landmarks × 3 coordinates ---

export interface LandmarkFilterBank {
  filters: OneEuroState[][]; // [landmarkIndex][0=x, 1=y, 2=z]
}

export function createLandmarkFilterBank(): LandmarkFilterBank {
  const filters: OneEuroState[][] = [];
  for (let i = 0; i < 33; i++) {
    filters.push([createOneEuroState(), createOneEuroState(), createOneEuroState()]);
  }
  return { filters };
}

export function filterLandmarks(
  bank: LandmarkFilterBank,
  landmarks: NormalizedLandmark[],
  timestampMs: number,
): NormalizedLandmark[] {
  return landmarks.map((lm, i) => {
    const f = bank.filters[i];
    if (!f) return lm;
    return {
      x: filterOneEuro(f[0]!, lm.x, timestampMs),
      y: filterOneEuro(f[1]!, lm.y, timestampMs),
      z: filterOneEuro(f[2]!, lm.z, timestampMs),
      visibility: lm.visibility,
    };
  });
}

// --- Angle Calculations (pure math, uses world landmarks only) ---

interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Calculate angle at point B formed by vectors BA and BC, in degrees */
export function calculateAngle(a: Point3D, b: Point3D, c: Point3D): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/** Distance between two 3D points in world coordinates (meters) */
export function distance3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Angle of a line segment relative to vertical (0° = straight up), in degrees */
export function angleFromVertical(top: Point3D, bottom: Point3D): number {
  const dx = top.x - bottom.x;
  const dy = bottom.y - top.y; // y increases downward in world coords
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// --- Orientation Detection (see PRD Section 11.6) ---

export type Orientation = 'frontal' | 'lateral' | 'ambiguous';

export function detectOrientation(
  leftShoulder: NormalizedLandmark,
  rightShoulder: NormalizedLandmark,
): Orientation {
  const shoulderPixelDistance = Math.abs(leftShoulder.x - rightShoulder.x);
  const shoulderDepthDiff = Math.abs(leftShoulder.z - rightShoulder.z);
  const orientationRatio = shoulderPixelDistance / Math.max(shoulderDepthDiff, 0.01);

  if (shoulderPixelDistance > 0.15 && orientationRatio > 3.0) return 'frontal';
  if (shoulderPixelDistance < 0.10 || orientationRatio < 1.5) return 'lateral';
  return 'ambiguous';
}
