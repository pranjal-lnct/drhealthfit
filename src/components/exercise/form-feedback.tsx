'use client';

import { useExerciseStore } from '@/stores/exercise-store';
import { MAX_CORRECTION_CARDS } from '@/config/constants';

export function FormFeedback() {
  const feedback = useExerciseStore((s) => s.activeFeedback);

  const visible = feedback.slice(0, MAX_CORRECTION_CARDS);

  if (visible.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 space-y-2 pointer-events-none">
      {visible.map((item) => (
        <div
          key={item.name}
          className={`px-4 py-2 rounded-lg text-sm font-medium max-w-[280px] animate-in slide-in-from-left duration-200 ${
            item.severity === 'error'
              ? 'bg-red-500/90 text-white'
              : 'bg-yellow-500/90 text-black'
          }`}
        >
          {item.severity === 'error' ? '🔴' : '⚠️'} {item.voiceFeedback}
        </div>
      ))}
    </div>
  );
}
