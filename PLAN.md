# DrHealthFit — Physiotherapy Exercise Assistant (Prototype)

## Context

Build a web-based prototype that uses the laptop/mobile camera and voice to assist patients doing physiotherapy exercises at home. The app detects body pose in real-time, counts reps, validates form, provides voice guidance, and ensures the patient is doing exercises correctly.

**Focus:** Clinical-grade correctness of exercise detection and quality of patient guidance, incorporating state-of-the-art biomechanical tracking. No authentication, no database, no progress tracking — just the core exercise experience done right.

**Initial scope:** 2 exercises — Neck Rotation and Squat.

---

## Tech Stack (Prototype)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| UI Components | shadcn/ui + Lucide icons |
| Pose Detection | `@mediapipe/tasks-vision` (33 3D landmarks, 30+ FPS) |
| State Management | Zustand |
| Voice Output | Web Speech API (SpeechSynthesis) |
| Validation | Zod |

**Not in prototype:** PostgreSQL, Prisma, Auth.js, Recharts, Speech Recognition (voice input).

---

## Project Structure (Prototype)

```
drhealthfit_2/
├── next.config.ts                      # COOP/COEP headers for SharedArrayBuffer
├── public/
│   └── models/
│       └── pose_landmarker_lite.task   # MediaPipe model file
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Landing: pick exercise
│   │   ├── globals.css
│   │   └── session/
│   │       └── [exerciseId]/page.tsx   # Active exercise session
│   ├── components/
│   │   ├── ui/                         # shadcn/ui primitives
│   │   ├── camera/
│   │   │   ├── camera-feed.tsx         # <video> element with camera stream
│   │   │   ├── pose-overlay.tsx        # Canvas: skeleton, ghost pose, joint colors
│   │   │   ├── pose-provider.tsx       # MediaPipe init + detection loop
│   │   │   └── exercise-viewport.tsx   # Composite: camera + overlay + HUD
│   │   └── exercise/
│   │       ├── exercise-card.tsx       # Exercise selection card
│   │       ├── exercise-setup.tsx      # Pre-exercise setup flow (now 4 steps)
│   │       ├── exercise-hud.tsx        # Reps, timer, phase, form score, Visual Hold Ring
│   │       ├── debug-hud.tsx           # Toggle: show all joint angles in real-time
│   │       ├── form-feedback.tsx       # Floating correction cards (max 2)
│   │       ├── rep-counter.tsx         # Animated counter with pulse
│   │       └── exercise-complete.tsx   # Summary + JSON export button
│   ├── lib/
│   │   └── utils.ts                    # cn(), formatters
│   ├── core/
│   │   ├── pose/
│   │   │   ├── landmarks.ts            # Landmark indices (33 points) + skeleton connections
│   │   │   ├── types.ts                # Pose data types (normalized vs world)
│   │   │   ├── pose-math.ts            # Angles, distances, 1 Euro filter, orientation detection
│   │   │   ├── pose-detector.ts        # MediaPipe PoseLandmarker wrapper
│   │   │   ├── environmental.ts        # Brightness/contrast checks for backlighting
│   │   │   └── biomechanics.ts         # Timestamp-normalized velocity, DTW, bone ratios
│   │   ├── exercise/
│   │   │   ├── types.ts                # ExerciseDefinition, Phase, FormRule, Setup config
│   │   │   ├── exercise-engine.ts      # FSM: SETUP → READY → ACTIVE → COMPLETED
│   │   │   ├── exercise-setup.ts       # Environmental, Orientation, Visibility, Ghost, Calibration
│   │   │   ├── exercise-validator.ts   # Form rule evaluation + per-rep scoring
│   │   │   └── exercise-registry.ts    # Exercise ID → definition map
│   │   ├── exercises/
│   │   │   ├── neck-rotation.ts        # Neck rotation definition
│   │   │   └── squat.ts               # Squat definition
│   │   └── voice/
│   │       ├── types.ts                # SpeechQueueItem, priority levels
│   │       └── speech-synthesis.ts     # TTS with interrupt/queue/drop priority
│   ├── stores/
│   │   ├── pose-store.ts              # Current landmarks, FPS, confidence
│   │   ├── exercise-store.ts          # Exercise state, reps, sets, form score, feedback
│   │   └── voice-store.ts            # Voice enabled, current utterance
│   ├── hooks/
│   │   ├── use-camera.ts             # getUserMedia lifecycle, permissions, cleanup
│   │   ├── use-exercise-session.ts   # Orchestration: pose → engine → voice → UI
│   │   └── use-voice-guidance.ts     # Connects exercise events to speech manager
│   └── config/
│       └── patient-profile.ts         # Hardcoded prototype patient thresholds
```

---

## Architecture

### Pose Detection Pipeline

```
Camera (getUserMedia) → <video> element
    → requestAnimationFrame captures frame + performance.now()
    → Environmental Check (Brightness/Contrast to avoid silhouetting)
    → MediaPipe PoseLandmarker.detectForVideo()
    → 33 landmarks:
        - poseLandmarks (2D normalized) → UI Overlay & Ghost
        - poseWorldLandmarks (3D real-world meters) → Physics & Biomechanics
    → 1 Euro Filter (dynamic signal smoothing)
    → Biomechanical Analysis (Timestamp-normalized velocity, Trajectory deviation, Bone length ratios)
    → Zustand pose-store
    → pose-overlay (traffic-light skeleton + ghost pose)
    → exercise-setup (environmental → orientation → visibility → ghost → calibration)
    → exercise-engine (phase tracking, rep counting, form validation)
    → form-feedback (visual correction cards)
    → voice guidance (interrupt/queue/drop priority) + Visual Hold Ring fallback
```

### Advanced Biomechanical Tracking

**1. Dual Coordinate Parsing (Monocular Depth Ambiguity Fix):**
- **UI:** Use `poseLandmarks` ONLY for rendering the ghost overlay and tracking dots on the video canvas.
- **Physics:** Use `poseWorldLandmarks` ONLY for all joint angle and biomechanical calculations to avoid perspective distortion and FOV scaling issues.

**2. Signal Smoothing (1 Euro Filter):**
- Replaces standard EMA. Standard EMA introduces too much lag at low frame rates.
- The 1 Euro filter dynamically adjusts its smoothing factor: high smoothing when the patient is still (removes jitter), low smoothing when moving fast (removes lag).

**3. Spatiotemporal Sequence Tracking (Timestamp-Normalized Velocity):**
- Because mobile devices thermal-throttle (FPS drops), calculating velocity purely by frames causes false jerks.
- Every landmark is paired with `performance.now()`.
- Velocity is strictly calculated as `degrees / millisecond` or `meters / millisecond`. This ensures slow movement is recognized correctly even if the frame rate tanks.

**4. Dynamic "Golden Rep" Trajectory Matching (DTW):**
- Compare the patient's live movement against a "Golden Reference" trajectory (captured during setup) using Dynamic Time Warping (DTW).
- Catch complex compensations (e.g., shifting weight to one side).

**5. Bone Length Ratio Calibration:**
- During setup, we capture the patient's specific bone length ratios (e.g., thigh vs shin) using world landmarks.
- If this ratio drastically changes mid-exercise, it implies perspective distortion or foreshortening. The system can reject the frame to prevent false form errors.

**6. Strict Occlusion-Resistant Confidence Gating:**
- If the visibility of any critical joint drops below `0.6`, the system pauses scoring and feedback.
- Voice interrupts: "I can't see your right leg clearly. Please adjust your angle."

---

### Pre-Exercise Setup Flow

The engine state machine is: **SETUP → READY → ACTIVE → COMPLETED**.

SETUP now has **4 sequential checks**. Auto-advance requires 1.5s of passing state.

#### Step 0: Environmental Check (New)
- Draw a low-res frame to a hidden canvas and calculate brightness/contrast.
- Fails if strongly backlit (silhouetting) or too dark.
- Prompt + voice: "Your room is too dark, or there is a bright light behind you. Please adjust your lighting."

#### Step 1: Camera Orientation Check
- Detect orientation via left-right shoulder pixel distance.
- Prompt + voice: "Please face the camera" / "Please turn sideways".

#### Step 2: Visibility & Ghost Pose Alignment
- Verify all `requiredLandmarks` have visibility > 0.6.
- **Ghost Pose**: Draw a semi-transparent perfect skeleton on the canvas. Patient must "step into" the ghost (red → yellow → green).

#### Step 3: Calibration & Golden Rep Capture
- **Static Baseline (2s):** Capture starting posture, standing knee angle, hip-to-floor height, and calculate individualized Bone Length Ratios.
- **Golden Rep:** System guides the patient through ONE slow, perfect rep. "Let's do one practice rep slowly. Down... and up."
- This 3D trajectory is saved as the patient's "Golden Reference".
- Transition to ACTIVE state.

---

### Exercise Definition System

Each exercise includes declarative logic for phases, form rules, and voice cues.

```typescript
interface FormRule {
  name: string;
  check: (worldLandmarks, baseline, trajectoryDeviation, velocityProfile) => { passed: boolean; severity: 'warning' | 'error' };
  voiceFeedback: string;
  visualTargetJoints: number[];       // which joints to color red/yellow
  cooldownMs: number;                 // prevent nagging
  priority: 'safety' | 'form' | 'optimization';
}
```

### Visual Guidance System

- **Traffic-Light Skeleton:** Per-joint status. If a specific form rule fails (e.g., knee over toe), only that specific joint turns red/yellow.
- **Visual Hold Ring (Audio Fallback):** Web Speech API can freeze on mobile. When a phase requires a hold (e.g., "Hold... good"), a massive, unmissable progress ring fills up on screen so the patient isn't left hanging if the audio drops.
- **Haptic Feedback:** Short vibration on rep complete, double-pulse on form error (mobile only).

### Feedback System & Voice Priority

Strict priority controls:

| Priority | Behavior | Examples |
|----------|----------|---------|
| **INTERRUPT** | Cancels current speech, speaks immediately | "Straighten your back!" (safety), "I lost sight of you." (occlusion) |
| **QUEUE** | Waits for current speech to finish | "Rep 3", "Now turn right" |
| **DROP** | Discarded if anything is currently speaking | "Great form!" |

---

### Rep Counting & Scoring

#### Per-Rep Scoring (0-100)
| Factor | Weight | What |
|--------|--------|------|
| Depth/range achieved | 25% | Hit the patient's calibrated target angle? |
| Form rules passed | 30% | How many form rules were clean? |
| Smoothness (Velocity) | 20% | Slow and controlled without jerking (Timestamp-normalized)? |
| Trajectory Alignment | 15% | Followed their Golden Rep path (no compensation)? |
| Hold time | 10% | Held at end-range (Visual Ring completed)? |

---

### Error Recovery

| Scenario | Behavior |
|----------|----------|
| **Backlighting / Environment** | Step 0 catches this before the exercise starts. |
| **Occlusion / Lost tracking** | Confidence drops < 0.6. Pause timer/scoring. Voice: "I can't see you clearly, adjust your angle." |
| **Audio API Crash** | Visual Hold Ring ensures patient still gets hold timing. |
| **Perspective Distortion** | Bone Length Ratio check rejects warped frames. |

---

## Prototype-Specific Strategies

#### 1. Hardcoded Patient Profile
```typescript
export const patientProfile = {
  name: 'Patient A',
  targetReps: 10,
  targetSets: 3,
  difficultyModifier: 1.0,        // Scales deviation thresholds
};
```

#### 2. Debug HUD
Toggleable overlay showing joint angles, confidence scores, current phase, timestamp-velocity graph, 1 Euro filter status, and DTW deviation.

#### 3. JSON Session Export
Export rep scores, durations, and calibration data to analyze accuracy offline.

---

## Implementation Steps (Prototype)

| Step | What | Key Files |
|------|------|-----------|
| 1 | Project bootstrap | `create-next-app`, UI setup |
| 2 | Pose infrastructure | `pose-math.ts` (1 Euro Filter), `environmental.ts`, `biomechanics.ts` (Timestamp-Velocity, DTW, Bone Ratios), `pose-detector.ts` |
| 3 | Camera components | `camera-feed.tsx`, `pose-overlay.tsx` (traffic-light skeleton) |
| 4 | Exercise engine | `exercise-engine.ts`, `exercise-setup.ts` (4 steps including Environmental & Golden Rep), `exercise-validator.ts` |
| 5 | Exercise definitions | `neck-rotation.ts`, `squat.ts` |
| 6 | Voice guidance | `speech-synthesis.ts` (priority queues) + Visual Hold Ring UI |
| 7 | Exercise UI | HUDs, rep counter, form feedback cards |
| 8 | Pages | `page.tsx`, `session/[exerciseId]/page.tsx` |
