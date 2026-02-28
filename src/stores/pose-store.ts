import { create } from 'zustand';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

interface PoseState {
  /** 2D normalized landmarks for UI overlay */
  normalizedLandmarks: NormalizedLandmark[] | null;
  /** 3D filtered world landmarks for physics */
  worldLandmarks: NormalizedLandmark[] | null;
  timestampMs: number;
  fps: number;
  isTracking: boolean;
  isDistorted: boolean;

  setFrame: (
    normalized: NormalizedLandmark[],
    world: NormalizedLandmark[],
    timestampMs: number,
    fps: number,
    isDistorted: boolean,
  ) => void;
  setTracking: (tracking: boolean) => void;
  reset: () => void;
}

export const usePoseStore = create<PoseState>((set) => ({
  normalizedLandmarks: null,
  worldLandmarks: null,
  timestampMs: 0,
  fps: 0,
  isTracking: false,
  isDistorted: false,

  setFrame: (normalized, world, timestampMs, fps, isDistorted) =>
    set({ normalizedLandmarks: normalized, worldLandmarks: world, timestampMs, fps, isTracking: true, isDistorted }),

  setTracking: (tracking) => set({ isTracking: tracking }),
  reset: () => set({ normalizedLandmarks: null, worldLandmarks: null, timestampMs: 0, fps: 0, isTracking: false, isDistorted: false }),
}));
