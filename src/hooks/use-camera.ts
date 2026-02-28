'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { CAMERA_WIDTH, CAMERA_HEIGHT } from '@/config/constants';
import { dbg } from '@/lib/debug-logger';

export type CameraError = 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError' | 'unknown';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const start = useCallback(async () => {
    dbg.info('Camera', 'Requesting camera access', { width: CAMERA_WIDTH, height: CAMERA_HEIGHT });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      dbg.info('Camera', 'Stream acquired', track?.getSettings());

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        dbg.info('Camera', 'Video playing', { readyState: videoRef.current.readyState, videoWidth: videoRef.current.videoWidth, videoHeight: videoRef.current.videoHeight });
        setIsReady(true);
        setError(null);
      } else {
        dbg.warn('Camera', 'videoRef.current is null after stream acquired');
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : 'unknown';
      dbg.error('Camera', 'getUserMedia failed', { name, message: (err as Error).message });
      setError(name as CameraError);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, isReady, error, start, stop };
}
