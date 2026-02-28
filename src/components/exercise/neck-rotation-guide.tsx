'use client';

import { memo } from 'react';
import { useExerciseStore } from '@/stores/exercise-store';

export const NeckRotationGuide = memo(function NeckRotationGuide() {
  const debugMetrics = useExerciseStore((s) => s.debugMetrics);
  const currentPhase = useExerciseStore((s) => s.currentPhase);

  if (!debugMetrics?.currentAngles.rotationAngle) return null;

  const rotationAngle = debugMetrics.currentAngles.rotationAngle;

  // Constants matching neck-rotation.ts thresholds
  const CENTER_THRESHOLD = 10;
  const ROTATION_TARGET = 20; // Entry threshold for counting
  const MAX_ROTATION = 90; // Maximum expected rotation

  // Arc configuration
  const centerX = 200;
  const centerY = 180;
  const radius = 120;
  const arcWidth = 16;

  // Convert angle to arc position (-90° to +90°)
  // SVG arc goes clockwise, so we need to flip for left rotation
  const angleToRadians = (deg: number) => ((deg + 90) * Math.PI) / 180;

  // Calculate position for current rotation indicator
  const currentAngleRad = angleToRadians(-rotationAngle); // Flip for correct direction
  const indicatorX = centerX + radius * Math.cos(currentAngleRad);
  const indicatorY = centerY + radius * Math.sin(currentAngleRad);

  // Helper to create arc path
  const createArcPath = (startAngle: number, endAngle: number) => {
    const start = angleToRadians(startAngle);
    const end = angleToRadians(endAngle);
    const startX = centerX + radius * Math.cos(start);
    const startY = centerY + radius * Math.sin(start);
    const endX = centerX + radius * Math.cos(end);
    const endY = centerY + radius * Math.sin(end);

    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  };

  // Determine indicator color based on phase
  const getIndicatorColor = () => {
    if (currentPhase === 'CENTER') return '#60a5fa'; // blue-400
    if (currentPhase === 'LEFT_ROTATION') return '#22c55e'; // green-500
    if (currentPhase === 'RIGHT_ROTATION') return '#22c55e'; // green-500
    return '#9ca3af'; // gray-400
  };

  // Determine if rotation is in target zone
  const absRotation = Math.abs(rotationAngle);
  const isInTarget = absRotation >= ROTATION_TARGET;
  const isInCenter = absRotation < CENTER_THRESHOLD;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none">
      <svg width="400" height="200" className="drop-shadow-2xl">
        {/* Background arc (full range) */}
        <path
          d={createArcPath(-MAX_ROTATION, MAX_ROTATION)}
          stroke="#ffffff20"
          strokeWidth={arcWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Left target zone (-20° to -90°) */}
        <path
          d={createArcPath(-MAX_ROTATION, -ROTATION_TARGET)}
          stroke="#22c55e40"
          strokeWidth={arcWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Right target zone (+20° to +90°) */}
        <path
          d={createArcPath(ROTATION_TARGET, MAX_ROTATION)}
          stroke="#22c55e40"
          strokeWidth={arcWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Center zone (-10° to +10°) */}
        <path
          d={createArcPath(-CENTER_THRESHOLD, CENTER_THRESHOLD)}
          stroke="#60a5fa60"
          strokeWidth={arcWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Target markers at ±20° */}
        <circle
          cx={centerX + radius * Math.cos(angleToRadians(-ROTATION_TARGET))}
          cy={centerY + radius * Math.sin(angleToRadians(-ROTATION_TARGET))}
          r="8"
          fill="#22c55e"
          className="animate-pulse"
        />
        <circle
          cx={centerX + radius * Math.cos(angleToRadians(ROTATION_TARGET))}
          cy={centerY + radius * Math.sin(angleToRadians(ROTATION_TARGET))}
          r="8"
          fill="#22c55e"
          className="animate-pulse"
        />

        {/* Center marker at 0° */}
        <circle
          cx={centerX + radius * Math.cos(angleToRadians(0))}
          cy={centerY + radius * Math.sin(angleToRadians(0))}
          r="6"
          fill="#60a5fa"
        />

        {/* Current position indicator (larger, animated) */}
        <g className="transition-all duration-100">
          {/* Outer glow */}
          <circle
            cx={indicatorX}
            cy={indicatorY}
            r="20"
            fill={getIndicatorColor()}
            opacity="0.3"
            className={isInTarget || isInCenter ? 'animate-pulse' : ''}
          />
          {/* Inner indicator */}
          <circle
            cx={indicatorX}
            cy={indicatorY}
            r="12"
            fill={getIndicatorColor()}
            stroke="white"
            strokeWidth="3"
          />
        </g>

        {/* Labels */}
        <text
          x={centerX + radius * Math.cos(angleToRadians(-45))}
          y={centerY + radius * Math.sin(angleToRadians(-45)) - 15}
          fill="white"
          fontSize="14"
          fontWeight="bold"
          textAnchor="middle"
          className="drop-shadow-lg"
        >
          ← LEFT
        </text>
        <text
          x={centerX + radius * Math.cos(angleToRadians(45))}
          y={centerY + radius * Math.sin(angleToRadians(45)) - 15}
          fill="white"
          fontSize="14"
          fontWeight="bold"
          textAnchor="middle"
          className="drop-shadow-lg"
        >
          RIGHT →
        </text>
        <text
          x={centerX}
          y={centerY - radius - 10}
          fill="white"
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
          className="drop-shadow-lg"
        >
          CENTER
        </text>

        {/* Angle display */}
        <text
          x={centerX}
          y={centerY + 40}
          fill="white"
          fontSize="28"
          fontWeight="bold"
          textAnchor="middle"
          className="drop-shadow-lg font-mono"
        >
          {rotationAngle.toFixed(0)}°
        </text>
      </svg>

      {/* Status text with next direction hint */}
      <div className="text-center mt-2 space-y-1">
        {isInCenter && (
          <div className="text-blue-400 text-lg font-bold drop-shadow-lg animate-pulse">
            ✓ Centered
          </div>
        )}
        {isInTarget && currentPhase === 'LEFT_ROTATION' && (
          <>
            <div className="text-green-400 text-lg font-bold drop-shadow-lg animate-pulse">
              ✓ Left Target Reached
            </div>
            <div className="text-yellow-300 text-sm font-semibold drop-shadow-lg">
              Now turn RIGHT →
            </div>
          </>
        )}
        {isInTarget && currentPhase === 'RIGHT_ROTATION' && (
          <>
            <div className="text-green-400 text-lg font-bold drop-shadow-lg animate-pulse">
              ✓ Right Target Reached
            </div>
            <div className="text-yellow-300 text-sm font-semibold drop-shadow-lg">
              ← Now turn LEFT
            </div>
          </>
        )}
      </div>
    </div>
  );
});
