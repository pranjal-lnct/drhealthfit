'use client';

import { useEffect, useState } from 'react';
import { usePoseStore } from '@/stores/pose-store';
import { useExerciseStore } from '@/stores/exercise-store';

export function DebugHUD() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setVisible((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) return null;

  return <DebugPanel />;
}

function DebugPanel() {
  const isTracking = usePoseStore((s) => s.isTracking);
  const engineState = useExerciseStore((s) => s.engineState);
  const phase = useExerciseStore((s) => s.currentPhase);
  const rep = useExerciseStore((s) => s.currentRep);
  const set = useExerciseStore((s) => s.currentSet);
  const lastScore = useExerciseStore((s) => s.lastRepScore);
  const debugMetrics = useExerciseStore((s) => s.debugMetrics);
  const [phaseLog, setPhaseLog] = useState<string[]>([]);

  useEffect(() => {
    if (phase) setPhaseLog((prev) => [...prev.slice(-4), phase]);
  }, [phase]);

  return (
    <div className="absolute top-2 left-2 bg-black/90 text-green-400 font-mono text-sm p-3 rounded-lg z-50 pointer-events-none space-y-1 min-w-72 max-h-[90vh] overflow-y-auto">
      <div className="text-yellow-300 font-bold text-base mb-1">Engine: {engineState} | Phase: {phase || '—'}</div>
      <div className="text-yellow-300 font-bold text-base">Rep: {rep} | Set: {set} | Tracking: {isTracking ? '✓' : '✗'}</div>
      <div className="text-orange-300 text-sm">Seq: {phaseLog.join(' → ') || '(none yet)'}</div>

      {debugMetrics && (
        <>
          <div className="border-t border-green-800 my-1" />
          <div className="text-cyan-300 font-bold">Rotation</div>
          <div className="text-base">
            rotationAngle: <span className="text-white">{debugMetrics.currentAngles.rotationAngle?.toFixed(1) ?? '?'}°</span>
          </div>
          <div className="text-base">
            absRotation: <span className="text-white">{debugMetrics.currentAngles.absRotation?.toFixed(1) ?? '?'}°</span>
          </div>
          <div className="text-gray-400">CENTER if abs &lt; 10° | ROTATE if abs &gt; 20°</div>
          <div className="text-gray-400">LEFT if rot ≤ -20° | RIGHT if rot ≥ 20°</div>

          <div className="border-t border-green-800 my-1" />
          <div className="text-cyan-300 font-bold">Other</div>
          <div>shoulderTilt: {debugMetrics.currentAngles.shoulderTilt?.toFixed(3) ?? '?'} (max 0.20)</div>
          <div>trunkDelta: {debugMetrics.currentAngles.trunkRotationDelta?.toFixed(3) ?? '?'}</div>
          <div>velocity: {debugMetrics.velocityProfile.currentVelocity.toFixed(1)}°/s</div>
        </>
      )}

      {lastScore && (
        <>
          <div className="border-t border-green-800 my-1" />
          <div className="text-green-300 font-bold">Last Rep</div>
          <div>Score: {lastScore.total} | ROM: {lastScore.rangeOfMotion} | Form: {lastScore.formCompliance}</div>
        </>
      )}
    </div>
  );
}
