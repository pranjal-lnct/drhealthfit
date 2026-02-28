'use client';

import { useExerciseStore } from '@/stores/exercise-store';

interface SetupStepConfig {
  label: string;
  description: string;
}

const STEPS: Record<string, SetupStepConfig> = {
  ENVIRONMENTAL: { label: 'Lighting Check', description: 'Checking your room lighting...' },
  ORIENTATION: { label: 'Position', description: 'Adjusting your camera angle...' },
  VISIBILITY: { label: 'Alignment', description: 'Step into the ghost pose...' },
  CALIBRATION: { label: 'Calibration', description: 'Capturing your baseline...' },
};

export function ExerciseSetup() {
  const step = useExerciseStore((s) => s.setupStep);
  const config = STEPS[step];

  const stepOrder = ['ENVIRONMENTAL', 'ORIENTATION', 'VISIBILITY', 'CALIBRATION'];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/70 rounded-2xl px-8 py-6 text-white text-center max-w-sm">
        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {stepOrder.map((s, i) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${
                i < currentIdx ? 'bg-green-500' : i === currentIdx ? 'bg-blue-500 animate-pulse' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        <h2 className="text-xl font-bold mb-2">{config?.label ?? 'Setup'}</h2>
        <p className="text-white/70">{config?.description ?? ''}</p>
      </div>
    </div>
  );
}
