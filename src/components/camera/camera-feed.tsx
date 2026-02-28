'use client';

import { forwardRef } from 'react';

export const CameraFeed = forwardRef<HTMLVideoElement>(function CameraFeed(_props, ref) {
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 h-full w-full object-cover -scale-x-100"
    />
  );
});
