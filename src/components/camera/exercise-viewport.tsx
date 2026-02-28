'use client';

import { forwardRef } from 'react';

import { CameraFeed } from './camera-feed';
import { PoseOverlay } from './pose-overlay';
import type { ExerciseDefinition } from '@/core/exercise/types';

interface ExerciseViewportProps {
  exercise: ExerciseDefinition;
  children?: React.ReactNode;
}

export const ExerciseViewport = forwardRef<HTMLVideoElement, ExerciseViewportProps>(
  function ExerciseViewport({ exercise, children }, videoRef) {
    return (
      <div className="relative w-full h-full bg-black overflow-hidden">
        <CameraFeed ref={videoRef} />
        <PoseOverlay exercise={exercise} />
        {children}
      </div>
    );
  },
);
