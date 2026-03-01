# DrHealthFit

AI-powered physiotherapy exercise app using real-time pose detection via MediaPipe PoseLandmarker.

## Prerequisites

- Node.js 18+
- A webcam
- Chrome or Edge (required for Web Speech API voice feedback)

## Setup

```bash
npm install
```

## Running

**Development** (hot reload, no build needed):
```bash
npm run dev
```

**Production** (recommended for performance):
```bash
npm run build
npm run start
```

Open [http://localhost:3000](http://localhost:3000)

> If port 3000 is in use: `lsof -ti :3000 | xargs kill -9`

## Exercises

| Exercise | Landmarks Used | Rep Sequence |
|----------|---------------|--------------|
| Neck Rotation | Nose, ears, eye inner, shoulders | Left → Center → Right → Center |
| Squat | Hips, knees, ankles, shoulders | Standing → Descent → Bottom Hold → Ascent → Standing |

## How It Works

1. Click **Start Exercise** — camera starts, pose detector loads (~2s)
2. Follow the on-screen arrow guide and phase text
3. Reps are counted automatically and announced via voice
4. Debug panel visible by default (press **D** to toggle)

## Architecture

```
src/
├── app/session/[exerciseId]/   # Session page
├── core/
│   ├── exercises/              # Exercise definitions (neck-rotation, squat)
│   ├── exercise/               # Engine, types, registry
│   └── pose/                   # MediaPipe wrapper, 1 Euro filter, biomechanics
├── hooks/
│   ├── use-exercise-session.ts # Main detection loop (20fps)
│   └── use-camera.ts           # Camera stream management
├── components/exercise/        # HUD, rep counter, phase guidance, form feedback
└── config/constants.ts         # All tunable thresholds
```

## Adding a New Exercise

1. Create `src/core/exercises/your-exercise.ts` implementing `ExerciseDefinition`
2. Register it in `src/core/exercise/exercise-registry.ts`
3. Add phase guidance text in `src/components/exercise/phase-guidance.tsx`

Key fields in `ExerciseDefinition`:
- `computeAngles` — extract angles from MediaPipe world landmarks
- `phases` — define phase entry/exit conditions
- `repSequence` — ordered phase names that complete one rep
- `formRules` — real-time form checks with voice feedback

## Models

MediaPipe PoseLandmarker model lives in `public/models/`. Currently using `pose_landmarker_full.task` (9MB, highest accuracy).

To switch to the lighter model (5.5MB, faster load):
```bash
# Already downloaded — just change one line in src/config/constants.ts:
MODEL_PATH = '/models/pose_landmarker_lite.task'
```

## Key Config (`src/config/constants.ts`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `MIN_VISIBILITY_CONFIDENCE` | 0.3 | Landmark visibility threshold |
| `ONE_EURO_MIN_CUTOFF` | 0.5 | Filter smoothing at rest |
| `ONE_EURO_BETA` | 0.05 | Filter responsiveness during movement |
| `MAX_CORRECTION_CARDS` | 1 | Max simultaneous form feedback cards |
| `LOW_FPS_THRESHOLD` | 15 | FPS below which performance warning fires |
