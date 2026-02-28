'use client';

import { useRef, useEffect } from 'react';

import { usePoseStore } from '@/stores/pose-store';
import { useExerciseStore } from '@/stores/exercise-store';
import { SKELETON_CONNECTIONS } from '@/core/pose/landmarks';
import type { ExerciseDefinition } from '@/core/exercise/types';

interface PoseOverlayProps {
  exercise: ExerciseDefinition;
}

export function PoseOverlay({ exercise }: PoseOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId: number;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas to parent size
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { normalizedLandmarks } = usePoseStore.getState();
      if (!normalizedLandmarks) return;

      const { errorJoints, warningJoints, engineState, setupStep } = useExerciseStore.getState();

      ctx.save();
      // Mirror to match CSS-mirrored video
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      // --- Ghost pose (setup only) ---
      if (engineState === 'SETUP' && (setupStep === 'VISIBILITY' || setupStep === 'CALIBRATION')) {
        drawGhostPose(ctx, canvas.width, canvas.height, exercise, normalizedLandmarks);
      }

      // --- Skeleton connections ---
      for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
        const start = normalizedLandmarks[startIdx];
        const end = normalizedLandmarks[endIdx];
        if (!start || !end) continue;
        if ((start.visibility ?? 0) < 0.5 || (end.visibility ?? 0) < 0.5) continue;

        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // --- Joint dots (traffic-light) ---
      for (let i = 0; i < normalizedLandmarks.length; i++) {
        const lm = normalizedLandmarks[i];
        if (!lm || (lm.visibility ?? 0) < 0.5) continue;

        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;

        let color = '#22c55e'; // green
        if (errorJoints.has(i)) color = '#ef4444'; // red
        else if (warningJoints.has(i)) color = '#eab308'; // yellow

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }

      ctx.restore();
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [exercise]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full pointer-events-none"
    />
  );
}

function drawGhostPose(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  exercise: ExerciseDefinition,
  currentLandmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[],
) {
  // Calculate alignment distance
  let totalDist = 0;
  let count = 0;

  for (const [idxStr, ghost] of Object.entries(exercise.ghostPose)) {
    const idx = Number(idxStr);
    const current = currentLandmarks[idx];
    if (!current) continue;

    const dx = current.x - ghost.x;
    const dy = current.y - ghost.y;
    totalDist += Math.sqrt(dx * dx + dy * dy);
    count++;
  }

  const avgDist = count > 0 ? totalDist / count : 1;

  let ghostColor: string;
  if (avgDist > exercise.ghostAlignRedThreshold) {
    ghostColor = 'rgba(239, 68, 68, 0.4)'; // red
  } else if (avgDist > exercise.ghostAlignYellowThreshold) {
    ghostColor = 'rgba(234, 179, 8, 0.4)'; // yellow
  } else {
    ghostColor = 'rgba(34, 197, 94, 0.4)'; // green
  }

  // Draw ghost dots
  for (const [, ghost] of Object.entries(exercise.ghostPose)) {
    ctx.beginPath();
    ctx.arc(ghost.x * width, ghost.y * height, 10, 0, 2 * Math.PI);
    ctx.fillStyle = ghostColor;
    ctx.fill();
    ctx.strokeStyle = ghostColor.replace('0.4', '0.8');
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
