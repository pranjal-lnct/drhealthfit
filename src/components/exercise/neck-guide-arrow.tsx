'use client';

import { useEffect, useState } from 'react';
import { usePoseStore } from '@/stores/pose-store';
import { useExerciseStore } from '@/stores/exercise-store';
import { LANDMARK } from '@/core/pose/landmarks';

type GuideState = 'STOP' | 'GO_LEFT' | 'GO_RIGHT' | 'RETURN';

export function NeckGuideArrow() {
  const phase = useExerciseStore((s) => s.currentPhase);
  const engineState = useExerciseStore((s) => s.engineState);
  const nose = usePoseStore((s) => s.normalizedLandmarks?.[LANDMARK.NOSE]);
  const [guide, setGuide] = useState<GuideState>('GO_LEFT');

  useEffect(() => {
    if (engineState !== 'ACTIVE') return;

    if (phase === 'LEFT_ROTATION') {
      setGuide('STOP');
      const t = setTimeout(() => setGuide('RETURN'), 800);
      return () => clearTimeout(t);
    }

    if (phase === 'RIGHT_ROTATION') {
      setGuide('STOP');
      const t = setTimeout(() => setGuide('RETURN'), 800);
      return () => clearTimeout(t);
    }

    if (phase === 'CENTER') {
      // Determine next direction from phase history
      setGuide((prev) => {
        if (prev === 'RETURN' || prev === 'STOP') {
          // After returning from left → go right next, and vice versa
          return 'GO_RIGHT';
        }
        if (prev === 'GO_LEFT') return 'GO_LEFT';
        return 'GO_LEFT';
      });
    }
  }, [phase, engineState]);

  // Track left/right alternation properly
  const [lastRotation, setLastRotation] = useState<'LEFT' | 'RIGHT' | null>(null);
  useEffect(() => {
    if (phase === 'LEFT_ROTATION') setLastRotation('LEFT');
    if (phase === 'RIGHT_ROTATION') setLastRotation('RIGHT');
    if (phase === 'CENTER' && lastRotation) {
      setGuide(lastRotation === 'LEFT' ? 'GO_RIGHT' : 'GO_LEFT');
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!nose || engineState !== 'ACTIVE') return null;

  // nose.x is mirrored (video is -scale-x-100), so flip x
  const x = (1 - nose.x) * 100;
  const y = nose.y * 100;

  const arrowMap: Record<GuideState, { symbol: string; color: string; label: string }> = {
    STOP:     { symbol: '⏸', color: '#ef4444', label: 'Hold' },
    GO_LEFT:  { symbol: '←', color: '#22d3ee', label: 'Turn Left' },
    GO_RIGHT: { symbol: '→', color: '#22d3ee', label: 'Turn Right' },
    RETURN:   { symbol: lastRotation === 'LEFT' ? '→' : '←', color: '#a3e635', label: 'Return' },
  };

  const { symbol, color, label } = arrowMap[guide];

  return (
    <div
      className="absolute pointer-events-none z-40 flex flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -120%)' }}
    >
      <span style={{ fontSize: 48, color, lineHeight: 1, textShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
        {symbol}
      </span>
      <span style={{ fontSize: 13, color, fontWeight: 700, textShadow: '0 0 6px rgba(0,0,0,0.9)', marginTop: 2 }}>
        {label}
      </span>
    </div>
  );
}
