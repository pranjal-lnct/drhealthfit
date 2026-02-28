import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

import { MODEL_PATH } from '@/config/constants';
import { dbg } from '@/lib/debug-logger';

let landmarker: PoseLandmarker | null = null;
let initPromise: Promise<PoseLandmarker> | null = null;
let lastTimestamp = -1;

export async function initPoseDetector(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  dbg.info('PoseDetector', 'Initializing MediaPipe PoseLandmarker', { modelPath: MODEL_PATH });
  const startTime = performance.now();

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );
    dbg.debug('PoseDetector', 'WASM fileset resolved', { elapsed: `${(performance.now() - startTime).toFixed(0)}ms` });

    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    dbg.info('PoseDetector', 'PoseLandmarker ready', { elapsed: `${(performance.now() - startTime).toFixed(0)}ms`, delegate: 'GPU' });
    return landmarker;
  })();

  initPromise.catch((err) => {
    dbg.error('PoseDetector', 'Init failed', { message: (err as Error).message, stack: (err as Error).stack });
  });

  return initPromise;
}

export function detectPose(
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult | null {
  if (!landmarker) return null;
  // MediaPipe requires strictly increasing timestamps
  if (timestampMs <= lastTimestamp) return null;
  lastTimestamp = timestampMs;

  try {
    return landmarker.detectForVideo(video, timestampMs);
  } catch {
    // WASM can throw on corrupted frames — skip, don't crash (see Coding Standards 8.2)
    dbg.warn('PoseDetector', 'detectForVideo threw (corrupted frame?)', { timestampMs });
    return null;
  }
}

export function closePoseDetector(): void {
  dbg.info('PoseDetector', 'Closing pose detector');
  landmarker?.close();
  landmarker = null;
  initPromise = null;
  lastTimestamp = -1;
}
