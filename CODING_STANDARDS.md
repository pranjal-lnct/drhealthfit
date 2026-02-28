# DrHealthFit - Coding Standards & Best Practices

Strict adherence to these rules ensures the application remains maintainable, highly performant on mobile devices, and safe for medical guidance.

---

## 1. Naming Conventions

### 1.1 Files and Directories
- **Kebab-case** for all files and directories: `pose-detector.ts`, `exercise-hud.tsx`, `use-camera.ts`
- `.tsx` for React component files, `.ts` for pure logic, stores, and utilities.

### 1.2 Code Constructs
- **PascalCase** for components, interfaces, types, enums: `ExerciseHUD`, `PoseLandmark`, `FormRule`
- **camelCase** for variables, functions, hooks: `calculateAngle`, `useCamera`, `currentPhase`
- **UPPER_SNAKE_CASE** for constants and thresholds: `MAX_FPS`, `MIN_VISIBILITY_THRESHOLD`
- **Boolean prefix** with `is`, `has`, `should`, `can`: `isReady`, `hasPermission`, `shouldRenderGhost`

### 1.3 Import Ordering

Enforce consistent import order in every file, separated by blank lines:

```typescript
// 1. React / Next.js
import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import { create } from 'zustand';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

// 3. Internal: core/ (pose, exercise, voice)
import { calculateAngle } from '@/core/pose/pose-math';
import { ExerciseEngine } from '@/core/exercise/exercise-engine';

// 4. Internal: stores, hooks, config
import { usePoseStore } from '@/stores/pose-store';
import { patientProfile } from '@/config/patient-profile';

// 5. Internal: components
import { CameraFeed } from '@/components/camera/camera-feed';

// 6. Types (type-only imports)
import type { NormalizedLandmark, Landmark } from '@/core/pose/types';
```

No barrel exports (`index.ts` re-exports). Import directly from the source file. Barrel exports obscure dependency graphs and break tree-shaking.

---

## 2. TypeScript Strictness

### 2.1 tsconfig Requirements

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 2.2 No `any`

`any` is banned. Use `unknown` and narrow with type guards when dealing with external data (MediaPipe outputs, Web Speech API events).

```typescript
// Bad
function processResult(result: any) { ... }

// Good
function processResult(result: unknown) {
  if (isPoseLandmarkerResult(result)) { ... }
}
```

### 2.3 Exhaustive FSM Switches

Every `switch` on FSM states or exercise phases must be exhaustive. Use the `never` trick to get compile-time errors when a new state is added but not handled:

```typescript
function handleState(state: EngineState): void {
  switch (state) {
    case 'SETUP': /* ... */ break;
    case 'READY': /* ... */ break;
    case 'ACTIVE': /* ... */ break;
    case 'COMPLETED': /* ... */ break;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled state: ${_exhaustive}`);
    }
  }
}
```

### 2.4 Zod for Runtime Validation

Exercise definitions loaded from the registry must be validated with Zod schemas at initialization. This catches malformed exercise configs at startup, not mid-session.

```typescript
const ExerciseDefinitionSchema = z.object({
  id: z.string(),
  requiredOrientation: z.enum(['frontal', 'lateral']),
  phases: z.array(PhaseSchema).min(2),
  formRules: z.array(FormRuleSchema).min(1),
  // ...
});

// Validate at registry load time, not per-frame
export function registerExercise(raw: unknown): ExerciseDefinition {
  return ExerciseDefinitionSchema.parse(raw);
}
```

---

## 3. Magic Number Prohibition

This project is full of biomechanical thresholds. **Every threshold must be a named constant.** No inline numbers in logic code.

```typescript
// Bad
if (visibility < 0.65) { pause(); }
if (kneeAngle > 160) { phase = 'STANDING'; }

// Good
const MIN_VISIBILITY_CONFIDENCE = 0.65;
const SQUAT_STANDING_ANGLE = 160;

if (visibility < MIN_VISIBILITY_CONFIDENCE) { pause(); }
if (kneeAngle > SQUAT_STANDING_ANGLE) { phase = 'STANDING'; }
```

**Where to define constants:**
- Global thresholds (visibility, FPS) → `src/config/constants.ts`
- Exercise-specific thresholds (angles, velocities) → inside each exercise definition file (`neck-rotation.ts`, `squat.ts`)
- Filter parameters (1 Euro, DTW) → at the top of the module that uses them (`pose-math.ts`, `biomechanics.ts`)

---

## 4. Performance Requirements (Critical for MediaPipe)

### 4.1 The Render Loop
- **Never put 30fps data into React state.** Do NOT use `useState` or Context for live landmark coordinates, joint angles, or velocity values. This re-renders the entire component tree 30 times per second.
- **Use `useRef` for live data.** Store high-frequency MediaPipe output in `useRef` or Zustand's transient update pattern (subscribe without triggering re-renders).
- **Direct canvas mutation.** `pose-overlay.tsx` draws to `<canvas>` directly within a `requestAnimationFrame` loop using `ref.current.getContext('2d')`.

### 4.2 Memory Management
- **MediaPipe cleanup.** The `PoseLandmarker` instance holds significant GPU/WASM memory. Call `.close()` on unmount in the hook's cleanup function. Verify with Chrome DevTools Memory tab.
- **Avoid object churn in the render loop.** Do not create new arrays or objects inside `requestAnimationFrame`. Pre-allocate and reuse:

```typescript
// Bad — creates 33 new objects per frame (30fps = 990 objects/sec → GC stutter)
const angles = landmarks.map(l => ({ x: l.x, y: l.y }));

// Good — mutate pre-allocated buffer
for (let i = 0; i < landmarks.length; i++) {
  angleBuffer[i].x = landmarks[i].x;
  angleBuffer[i].y = landmarks[i].y;
}
```

- **Cancel animation frames.** Store the `requestAnimationFrame` ID and call `cancelAnimationFrame` on cleanup.

### 4.3 Mathematical Optimizations
- **Timestamp-normalized math.** Always pass `performance.now()` with frames. Calculate velocities as `Δangle / Δtime`. Never assume constant FPS.
- **Pure functions.** All biomechanical calculations (1 Euro Filter, DTW, angle math, velocity profiling) must be pure, side-effect-free functions. This allows V8 to aggressively optimize them and makes them trivially unit-testable.

---

## 5. Architecture & State Management

### 5.1 Zustand Stores
- **Separation by domain:**
  - `pose-store.ts` — current raw and filtered landmarks, FPS, confidence
  - `exercise-store.ts` — rep counts, current phase, form scores, feedback
  - `voice-store.ts` — speech queue, mute state, current utterance
- **Transient updates** for 30fps data. Use Zustand's `subscribe` to read pose data without triggering React re-renders:

```typescript
// In the rAF loop — no re-render
const landmarks = usePoseStore.getState().worldLandmarks;

// In a React component that needs to show rep count (updates ~1/sec) — re-render is fine
const repCount = useExerciseStore(s => s.repCount);
```

### 5.2 Component Structure
- **Dumb components.** UI components (HUDs, feedback cards, rep counter) receive data via props or Zustand selectors. They contain zero biomechanical logic.
- **Custom hooks as controllers.** `use-exercise-session.ts` wires pose store → exercise engine → voice → UI. The hook is the orchestrator.
- **One component per file.** No multi-component files.

---

## 6. MediaPipe Specific Rules

### 6.1 Dual Coordinate Separation

This is the single most important rule in the codebase. Violating it causes subtle, hard-to-debug perspective distortion bugs.

| Output | Use For | Never Use For |
|--------|---------|---------------|
| `poseLandmarks` | 2D skeleton overlay, ghost pose alignment, UI rendering | Angle calculation, velocity, DTW, any physics |
| `poseWorldLandmarks` | All joint angles, velocity profiling, DTW, bone ratios, form rules | Canvas rendering (coords don't map to pixels) |

```typescript
// Bad — using normalized landmarks for angle math
const angle = calculateAngle(result.landmarks[0][11], result.landmarks[0][23], result.landmarks[0][25]);

// Good — using world landmarks for angle math
const angle = calculateAngle(result.worldLandmarks[0][11], result.worldLandmarks[0][23], result.worldLandmarks[0][25]);
```

### 6.2 Visibility Gating

Always check `visibility` before using a landmark. Use the project constant `MIN_VISIBILITY_CONFIDENCE` (0.65). Never hardcode the threshold value.

```typescript
if (landmark.visibility < MIN_VISIBILITY_CONFIDENCE) {
  // Treat as invalid — do not calculate angles, do not score
}
```

---

## 7. Canvas Rendering Rules

### 7.1 Frame Lifecycle

Every `requestAnimationFrame` callback must follow this exact sequence:

```typescript
function renderFrame(ctx: CanvasRenderingContext2D) {
  // 1. Clear entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Save context state
  ctx.save();

  // 3. Apply mirror transform (front camera is CSS-mirrored, canvas coords must match)
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  // 4. Draw layers in order (back to front):
  //    a. Ghost pose (semi-transparent, setup only)
  //    b. Skeleton connections (lines between joints)
  //    c. Joint dots (traffic-light colored)

  // 5. Restore context state
  ctx.restore();

  // 6. Draw non-mirrored UI overlays (hold ring, correction cards)
  //    These are drawn AFTER restore so they aren't mirrored
}
```

### 7.2 Coordinate Mapping

Ghost pose and skeleton overlay use `poseLandmarks` (normalized 0–1). Map to canvas pixels:

```typescript
const px = landmark.x * canvas.width;
const py = landmark.y * canvas.height;
```

Never use `poseWorldLandmarks` for canvas drawing.

---

## 8. Error Handling & Resilience

### 8.1 Error Boundaries

Wrap the session page in a React Error Boundary. If MediaPipe WASM crashes or any unhandled error occurs, show a recovery screen instead of a white page:

```typescript
// src/app/session/[exerciseId]/page.tsx
<SessionErrorBoundary fallback={<SessionCrashRecovery />}>
  <ExerciseSession exerciseId={exerciseId} />
</SessionErrorBoundary>
```

### 8.2 MediaPipe Try/Catch

`PoseLandmarker.detectForVideo()` can throw on corrupted frames or WASM OOM. Always wrap:

```typescript
let result: PoseLandmarkerResult | null = null;
try {
  result = poseLandmarker.detectForVideo(videoFrame, timestamp);
} catch (e) {
  // Log to debug HUD, skip frame, do NOT crash the loop
  console.warn('MediaPipe detection failed:', e);
  return;
}
```

### 8.3 Web Speech API Resilience

`SpeechSynthesis` can silently freeze on mobile Safari and some Android browsers. The speech manager must:
- Set a timeout (3s) on every utterance. If `onend` doesn't fire, force-cancel and move to next queue item.
- Never block the exercise engine waiting for speech to complete.
- The Visual Hold Ring exists specifically because audio is unreliable.

### 8.4 Camera Stream Recovery

If the camera stream ends unexpectedly (`track.onended`), attempt one automatic reconnect before showing the error UI.

---

## 9. Security Requirements

### 9.1 Browser Headers
- **COOP/COEP** for SharedArrayBuffer:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
- Configured in `next.config.ts` middleware.

### 9.2 Camera Permissions
- Do NOT auto-request camera on page load. Wait for explicit user action (clicking "Start Exercise" or "Allow Camera").
- Handle all `getUserMedia` error states: `NotAllowedError`, `NotFoundError`, `NotReadableError`, `OverconstrainedError`.

### 9.3 Data Handling
- **All processing client-side.** No video frames, images, or landmark data sent to any server.
- **JSON exports** must contain no PII. The hardcoded patient profile name is a placeholder, not real data.
- **No `dangerouslySetInnerHTML`.** All text rendered in feedback cards and voice cues is from exercise definitions (developer-authored strings), never user input. Still, never use `dangerouslySetInnerHTML`.

---

## 10. Code Organization Rules

### 10.1 Pure Core, Impure Shell

The `src/core/` directory must contain **zero React imports**. It is pure TypeScript — math, algorithms, state machines, types. This ensures:
- Core logic is testable without React/DOM
- Core logic is portable (could run in a Web Worker in the future)
- Clear separation between "what the app does" and "how it renders"

```
src/core/    → Pure TypeScript. No React. No DOM. No side effects.
src/hooks/   → React hooks that connect core logic to components.
src/stores/  → Zustand stores (thin wrappers, minimal logic).
src/components/ → React components (rendering only).
```

### 10.2 Function Size

- Max 40 lines per function. If longer, extract sub-functions.
- Exception: `requestAnimationFrame` render loops can be longer if well-commented with the layer sequence from Section 7.1.

### 10.3 Comments

- **No obvious comments.** Don't comment what the code does. Comment *why* — especially for biomechanical thresholds:

```typescript
// Bad
// Calculate the knee angle
const kneeAngle = calculateAngle(hip, knee, ankle);

// Good
// Knee angle from world landmarks — used for phase detection.
// Standing ≈ 170-180°, full squat ≈ 60-90° (see PRD Section 10.2)
const kneeAngle = calculateAngle(hip, knee, ankle);
```

- **Link to PRD sections** when implementing specific thresholds or algorithms. Future developers need to trace why a number is what it is.
