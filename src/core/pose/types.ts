import { type NormalizedLandmark } from '@mediapipe/tasks-vision';

// --- Pose Data Types ---

export interface TimestampedLandmarks {
  /** 2D normalized landmarks for UI rendering */
  normalized: NormalizedLandmark[];
  /** 3D world landmarks in meters for physics/biomechanics */
  world: NormalizedLandmark[];
  /** performance.now() timestamp of this frame */
  timestampMs: number;
}

export interface FilteredFrame {
  world: NormalizedLandmark[];
  timestampMs: number;
  isDistorted: boolean;
}

// --- Bone Length Ratios ---

export interface BoneLengthRatios {
  thighToShin: number;
  upperArmToForearm: number;
  torsoToThigh: number;
}

// --- Velocity ---

export interface VelocityFrame {
  angleDeg: number;
  timestampMs: number;
}

export interface VelocityProfile {
  /** degrees per second */
  currentVelocity: number;
  /** degrees per second squared */
  currentAcceleration: number;
  isJerky: boolean;
}
