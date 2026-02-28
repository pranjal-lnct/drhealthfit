# Product Requirements Document (PRD)

## DrHealthFit — AI Physiotherapy Exercise Assistant

| Field | Value |
|-------|-------|
| Product | DrHealthFit |
| Version | 0.1 (Prototype) |
| Author | Product Team |
| Date | 2026-02-28 |
| Status | Draft |

---

## 1. Executive Summary

DrHealthFit is a browser-based physiotherapy assistant that uses the patient's laptop or mobile camera to provide real-time exercise guidance at home. The system detects body pose, counts repetitions, validates exercise form against clinical biomechanical standards, and delivers voice coaching — replicating the core value of an in-person physiotherapy session without requiring any hardware beyond a standard device with a camera.

The prototype targets two exercises (Neck Rotation and Squat) and prioritizes clinical-grade correctness of movement detection and quality of patient guidance over breadth of features.

---

## 2. Problem Statement

Physiotherapy adherence at home is critically low. Studies consistently show that patients perform exercises incorrectly, skip sessions, or abandon programs entirely because they lack real-time feedback on whether they're doing movements correctly. The consequences are slower recovery, re-injury, and wasted clinical time when physiotherapists must re-teach exercises at follow-up appointments.

Existing solutions fall into two categories:
- **Video libraries** (e.g., YouTube, clinic-provided PDFs) — passive, no feedback, no way to know if form is correct
- **Wearable sensor systems** — expensive, require hardware the patient doesn't own, friction to adopt

There is no accessible, zero-hardware, browser-based solution that provides real-time biomechanical feedback with clinical-grade accuracy.

---

## 3. Target Users

### Primary: Physiotherapy Patients (Home Exercise Programs)

| Attribute | Detail |
|-----------|--------|
| Age range | 25–70 |
| Tech comfort | Can open a web browser and allow camera permissions |
| Context | Performing prescribed exercises at home, typically alone |
| Pain point | Unsure if they're doing exercises correctly; no feedback between clinic visits |
| Device | Laptop with webcam or smartphone (modern browser required) |

### Secondary: Physiotherapists (Future — Not in Prototype)

Would prescribe exercises through the platform and review session data remotely. Out of scope for v0.1 but the architecture should not preclude this.

---

## 4. Product Vision & Principles

**Vision:** Make every home physiotherapy session as effective as an in-clinic supervised session.

**Design Principles:**

1. **Clinical correctness over feature count.** A wrong form correction is worse than no correction. Every piece of feedback must be biomechanically defensible.
2. **The patient's hands are busy.** Zero touch interaction during exercise. Everything is voice + visual. No buttons to tap mid-squat.
3. **Don't nag.** Voice feedback uses strict priority and cooldown rules. The system speaks only when it has something important to say.
4. **Fail safe, not fail silent.** If the system can't see the patient clearly, it pauses and says so. It never guesses and gives bad medical feedback.
5. **Personalize to the body in front of the camera.** Calibrate thresholds to the individual patient's range of motion, not population averages.

---

## 5. Scope

### In Scope (Prototype v0.1)

| Category | What's Included |
|----------|----------------|
| Exercises | Neck Rotation, Squat |
| Pose detection | Real-time 33-landmark 3D body tracking via MediaPipe |
| Biomechanics | EMA signal smoothing, velocity profiling, DTW trajectory matching |
| Setup flow | Camera orientation check → visibility/ghost alignment → calibration + golden rep capture |
| Form validation | Declarative rule engine with per-joint severity, cooldowns, and priority |
| Rep counting | Phase-based FSM with per-rep scoring (0–100) |
| Voice guidance | Text-to-speech with interrupt/queue/drop priority system |
| Visual feedback | Traffic-light skeleton overlay, ghost pose, floating correction cards, animated rep counter |
| Haptics | Vibration on rep complete and form errors (mobile only) |
| Debug tools | Toggleable HUD showing joint angles, confidence, velocity, DTW deviation |
| Data export | JSON session export (rep scores, durations, calibration data) |
| Patient config | Hardcoded patient profile (reps, sets, difficulty modifier) |

### Out of Scope (Prototype v0.1)

| Category | Deferred To |
|----------|-------------|
| User authentication | v1.0 |
| Database / progress tracking | v1.0 |
| Physiotherapist dashboard | v1.0 |
| Exercise prescription system | v1.0 |
| Speech recognition (voice input) | v1.0 |
| Multi-person detection | Not planned |
| Charts / analytics UI | v1.0 |
| Exercise library beyond 2 exercises | v0.2+ |

---

## 6. User Flows

### 6.1 Exercise Selection (Landing Page)

```
Patient opens app
  → Sees exercise cards (Neck Rotation, Squat)
  → Each card shows: name, description, target muscles, estimated duration
  → Taps card
  → Navigates to /session/[exerciseId]
```

**Acceptance Criteria:**
- [ ] Exercise cards render with name, description, and visual indicator
- [ ] Tapping a card navigates to the correct session URL
- [ ] Page is responsive (works on mobile and desktop viewports)

### 6.2 Pre-Exercise Setup

This is the most critical UX flow. It must feel guided, not technical.

```
Session page loads
  → Camera permission requested
    → If denied: show clear instructions to enable, block progression
    → If granted: camera feed appears

  → STEP 0: Environmental Check (auto, ~2s)
    → System samples video frames to a hidden canvas, calculates average brightness and contrast
    → Fails if backlit (silhouetted) or too dark (<40 avg brightness on 0-255 scale)
    → Voice: "Your room is too dark, or there's a bright light behind you. Please adjust your lighting."
    → Green checkmark when brightness 40-220 and contrast ratio >1.5 held for 1.5s

  → STEP 1: Orientation Check (auto, ~3s)
    → System detects shoulder distance to determine facing direction
    → Voice: "Please face the camera" or "Please turn sideways"
    → Green checkmark when correct orientation held for 1.5s

  → STEP 2: Visibility & Ghost Alignment (~5-10s)
    → Semi-transparent "ghost skeleton" drawn on canvas (using poseLandmarks for positioning)
    → Patient steps into the ghost pose
    → Ghost color transitions: red → yellow → green as alignment improves
    → Voice: "Step back a little" / "Move to your left" / "Perfect position"
    → All required landmarks must have visibility > 0.65 for 1.5s

  → STEP 3: Calibration & Golden Rep (~10-15s)
    → Static baseline capture (2s hold): standing posture, joint angles, body proportions, bone length ratios
    → Voice: "Stand still for a moment... Good."
    → Golden Rep guided capture:
      → Voice: "Let's do one practice rep slowly. Down... and up."
      → System records full 3D trajectory (from poseWorldLandmarks) of the movement
      → This becomes the patient's personalized reference for the session
    → Voice: "Great. Let's begin."
    → Transition to ACTIVE state
```

**Acceptance Criteria:**
- [ ] Camera permission denial shows actionable instructions (not a generic error)
- [ ] Environmental check blocks progression when backlit or too dark, with specific guidance
- [ ] Each setup step auto-advances after 1.5s of passing state
- [ ] Ghost pose renders as semi-transparent skeleton with color transitions (using poseLandmarks)
- [ ] Orientation detection works for both frontal and lateral exercises
- [ ] Golden rep trajectory is captured from poseWorldLandmarks and stored in session memory
- [ ] Bone length ratios are captured during baseline and used for frame rejection during session
- [ ] Voice guides the patient through every step without requiring screen interaction
- [ ] Total setup time is under 35 seconds for a cooperative patient

### 6.3 Active Exercise Session

```
ACTIVE state begins
  → Timer starts
  → Rep counter visible (large, prominent)
  → Patient performs exercise

  Per frame (30+ FPS):
    → Pose detected → timestamp captured via performance.now()
    → poseLandmarks → skeleton overlay rendering
    → poseWorldLandmarks → 1 Euro Filter → angles calculated
    → Bone length ratio check: if >20% deviation from baseline, frame rejected (no scoring)
    → Phase tracked (e.g., descent → hold → ascent for squat)
    → Form rules evaluated against world landmarks + baseline + trajectory + velocity
    → Skeleton colored per-joint (green/yellow/red)
    → If hold phase active:
      → Visual Hold Ring fills progressively (audio-independent fallback)
    → If form error detected:
      → Correction card appears (max 2 visible, most recent + most severe)
      → Voice feedback fires (respecting priority + cooldown)
    → If rep completed:
      → Rep counter increments with pulse animation
      → Per-rep score calculated (0-100)
      → Voice: "Rep 3" or "Rep 3, nice form"

  If tracking lost:
    → Timer pauses
    → Scoring pauses
    → Voice: "I can't see you clearly. Please adjust your position."
    → Resumes automatically when tracking recovers

  When target reps × sets completed:
    → Transition to COMPLETED state
```

**Acceptance Criteria:**
- [ ] Pose detection runs at 30+ FPS on a modern laptop (2020+)
- [ ] Rep counter is accurate — no double-counts, no missed reps
- [ ] Form corrections appear within 500ms of detecting the error
- [ ] Voice feedback respects cooldown (3–5s per rule) — no nagging
- [ ] INTERRUPT priority voice cancels current speech immediately
- [ ] Tracking loss pauses the session and resumes automatically
- [ ] Skeleton overlay uses poseLandmarks; all angle math uses poseWorldLandmarks
- [ ] Visual Hold Ring displays during hold phases regardless of audio state
- [ ] Frames with distorted bone ratios are silently skipped (no scoring, no feedback)
- [ ] Maximum 2 correction cards visible simultaneously

### 6.4 Session Complete

```
All sets completed
  → Session summary screen:
    → Total reps completed
    → Average form score
    → Per-rep score breakdown
    → Session duration
    → Best rep / worst rep highlighted
  → "Export Session Data" button → downloads JSON file
  → "Do Another Exercise" button → returns to landing page
```

**Acceptance Criteria:**
- [ ] Summary displays within 1s of session completion
- [ ] JSON export contains: rep scores, rep durations, calibration data, exercise ID, timestamp
- [ ] Navigation back to landing page cleans up camera stream and all resources

---

## 7. Functional Requirements

### FR-1: Pose Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Detect 33 3D body landmarks using MediaPipe PoseLandmarker | P0 |
| FR-1.2 | Run detection at ≥30 FPS on modern hardware | P0 |
| FR-1.3 | Parse dual coordinate outputs: `poseLandmarks` (2D normalized) for UI rendering, `poseWorldLandmarks` (3D meters) for all physics/biomechanics | P0 |
| FR-1.4 | Apply 1 Euro Filter to all landmark coordinates before downstream use | P0 |
| FR-1.5 | Expose per-landmark visibility confidence scores | P0 |
| FR-1.6 | Gate all scoring/feedback behind visibility threshold (>0.65 for critical joints) | P0 |
| FR-1.7 | Pair every landmark frame with `performance.now()` timestamp for time-normalized calculations | P0 |

### FR-2: Biomechanical Analysis

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Calculate joint angles from 3D world landmark triplets (never from normalized/UI landmarks) | P0 |
| FR-2.2 | Track timestamp-normalized angular velocity (°/ms) to prevent false jerks at low FPS | P0 |
| FR-2.3 | Detect jerky/uncontrolled movement via velocity spike detection | P1 |
| FR-2.4 | Compare live movement trajectory against golden rep using DTW | P0 |
| FR-2.5 | Report trajectory deviation as a normalized distance score | P0 |
| FR-2.6 | Capture bone length ratios during calibration and reject frames where ratios deviate >20% (perspective distortion) | P0 |

### FR-3: Exercise Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Implement FSM with states: SETUP → READY → ACTIVE → COMPLETED | P0 |
| FR-3.2 | Track exercise phases (e.g., descent/hold/ascent) via angle thresholds | P0 |
| FR-3.3 | Count reps based on phase transitions (full cycle = 1 rep) | P0 |
| FR-3.4 | Track sets and transition between them | P0 |
| FR-3.5 | Evaluate declarative form rules per frame with cooldown enforcement | P0 |
| FR-3.6 | Score each completed rep on a 0–100 scale using weighted factors | P1 |

### FR-4: Setup & Calibration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Perform environmental check: detect backlighting/silhouetting and low-light conditions before proceeding | P0 |
| FR-4.2 | Detect camera orientation (frontal vs lateral) via shoulder distance | P0 |
| FR-4.3 | Validate visibility of all exercise-required landmarks (>0.65) | P0 |
| FR-4.4 | Render ghost pose overlay with alignment color feedback | P0 |
| FR-4.5 | Capture static baseline posture (2s hold) including bone length ratios | P0 |
| FR-4.6 | Guide and record golden rep trajectory | P0 |
| FR-4.7 | Calculate individualized thresholds from baseline measurements | P0 |

### FR-5: Voice Guidance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Synthesize speech using Web Speech API (SpeechSynthesis) | P0 |
| FR-5.2 | Implement 3-tier priority system: INTERRUPT, QUEUE, DROP | P0 |
| FR-5.3 | INTERRUPT cancels current utterance and speaks immediately | P0 |
| FR-5.4 | QUEUE waits for current utterance to finish | P0 |
| FR-5.5 | DROP is discarded if any utterance is currently playing | P0 |
| FR-5.6 | Allow user to mute/unmute voice guidance | P1 |

### FR-6: Visual Feedback

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Render skeleton overlay on camera feed with per-joint coloring (green/yellow/red) | P0 |
| FR-6.2 | Display ghost pose during setup with alignment color transitions | P0 |
| FR-6.3 | Show floating correction cards (max 2) with specific error descriptions | P0 |
| FR-6.4 | Animated rep counter with pulse effect on increment | P1 |
| FR-6.5 | HUD showing current reps, sets, timer, phase, and form score | P0 |
| FR-6.6 | Visual Hold Ring: large circular progress indicator during hold phases as audio fallback | P0 |
| FR-6.7 | Debug HUD (toggleable) with raw joint angles, confidence, velocity, DTW deviation, 1 Euro filter state, bone ratios | P1 |

### FR-7: Exercise Definitions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Neck Rotation: detect head turn angle, validate range of motion, count left/right as phases | P0 |
| FR-7.2 | Squat: detect knee angle, hip angle, validate depth, knee alignment, back angle | P0 |
| FR-7.3 | Each exercise declares: required orientation, required landmarks, phases, form rules, voice cues | P0 |
| FR-7.4 | Exercise registry maps exercise IDs to definitions | P0 |

---

## 8. Non-Functional Requirements

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-1 | Pose detection frame rate | ≥30 FPS on 2020+ laptop, ≥20 FPS on mid-range mobile | P0 |
| NFR-2 | End-to-end latency (frame capture → UI update) | <100ms | P0 |
| NFR-3 | Voice feedback latency (event → speech start) | <300ms for INTERRUPT | P0 |
| NFR-4 | Camera startup time | <3s from permission grant to first frame | P1 |
| NFR-5 | Total setup flow duration | <30s for cooperative patient | P1 |
| NFR-6 | Browser support | Chrome 90+, Safari 16+, Edge 90+ (desktop & mobile) | P0 |
| NFR-7 | Privacy | Zero data transmission — all processing client-side | P0 |
| NFR-8 | Accessibility | Voice guidance for all visual cues; high-contrast skeleton colors | P1 |
| NFR-9 | Mobile responsiveness | Full functionality on mobile viewports (portrait) | P0 |
| NFR-10 | Resource cleanup | Camera stream and ML model released on page exit | P0 |

---

## 9. Per-Rep Scoring Model

Each completed repetition receives a composite score (0–100):

| Factor | Weight | Measurement |
|--------|--------|-------------|
| Range of motion | 25% | Did the patient reach their calibrated target angle? Scored as `min(1, actualROM / goldenRepROM) × 100`. If patient reaches 80% of golden rep ROM, scores 80. |
| Form rule compliance | 30% | `(passingFrames / totalFrames) × 100` across all form rules during the rep. Safety violations count 2× (each failing frame counts as 2 failing frames). |
| Movement smoothness | 20% | Calculated per Section 11.2 velocity profiling smoothness score formula. |
| Trajectory alignment | 15% | Calculated per Section 11.3 DTW normalized score formula. |
| Hold time | 10% | `min(1, actualHoldMs / targetHoldMs) × 100`. Target hold: 500ms for squat bottom, 1000ms for neck rotation at each side. |

**Score interpretation (displayed to patient):**
- 90–100: "Excellent form"
- 75–89: "Good form"
- 60–74: "Needs improvement" (specific feedback shown)
- Below 60: "Let's focus on form" (specific feedback shown)

---

## 10. Exercise Specifications

### 10.1 Neck Rotation

| Attribute | Value |
|-----------|-------|
| Exercise ID | `neck-rotation` |
| Required orientation | Frontal (facing camera) |
| Required landmarks (MediaPipe indices) | Nose (0), Left eye inner (1), Right eye inner (4), Left ear (7), Right ear (8), Left shoulder (11), Right shoulder (12) |
| Default prescription | 10 reps × 3 sets, rest 30s between sets |

**Primary Angle Calculation:**
The head rotation angle is measured as the horizontal displacement ratio of the nose relative to the midpoint between the two ears, mapped to degrees. Specifically:
- `midEarX = (leftEar.x + rightEar.x) / 2`
- `noseOffset = nose.x - midEarX`
- `shoulderWidth = abs(leftShoulder.x - rightShoulder.x)`
- `rotationRatio = noseOffset / (shoulderWidth * 0.5)` — normalized to shoulder width
- `rotationAngle = rotationRatio * 90` — maps to approximate degrees (negative = left, positive = right)

**Phase Definitions & Thresholds:**

| Phase | Entry Condition | Exit Condition | Hysteresis Band |
|-------|----------------|----------------|-----------------|
| CENTER | `abs(rotationAngle) < 15°` | `abs(rotationAngle) ≥ 20°` | 5° band prevents flickering |
| LEFT_ROTATION | `rotationAngle ≤ -20°` | `rotationAngle > -15°` (returning to center) | 5° |
| RIGHT_ROTATION | `rotationAngle ≥ 20°` | `rotationAngle < 15°` (returning to center) | 5° |

**Rep Counting Logic:**
One rep = CENTER → LEFT_ROTATION → CENTER → RIGHT_ROTATION → CENTER. The FSM tracks a `phaseSequence` array. A rep is counted when the sequence `[CENTER, LEFT, CENTER, RIGHT, CENTER]` completes. Partial sequences (e.g., only left rotation) do not count.

**Target ROM:** Calibrated from golden rep. Normal healthy range is 70–90° each side. The system accepts any golden rep ROM between 30° and 90° as valid.

**Form Rules:**

| Rule Name | Check | Threshold | Severity | Voice Feedback | Target Joints | Cooldown | Priority |
|-----------|-------|-----------|----------|---------------|---------------|----------|----------|
| Shoulder Level | `abs(leftShoulder.y - rightShoulder.y) / shoulderWidth` | > 0.08 (≈5° tilt) | warning | "Keep your shoulders level" | 11, 12 | 4000ms | form |
| Trunk Rotation | `abs(leftShoulder.z - rightShoulder.z)` relative to baseline | > 1.5× baseline z-diff | warning | "Keep your body facing forward" | 11, 12 | 4000ms | form |
| Speed Control | Angular velocity of rotation angle | > 120°/s | warning | "Slower, control the movement" | 0 (nose) | 5000ms | form |
| Hypermobility | `abs(rotationAngle)` | > golden rep max + 10° OR > 95° absolute | error | "That's too far, come back a little" | 7 or 8 (ear) | 3000ms | safety |

**Ghost Pose (Normalized Coordinates):**
Frontal standing position, head centered. Coordinates are normalized to [0,1] range relative to the bounding box of the visible body:

```
nose: {x: 0.50, y: 0.18}
leftShoulder: {x: 0.62, y: 0.32}
rightShoulder: {x: 0.38, y: 0.32}
leftEar: {x: 0.58, y: 0.16}
rightEar: {x: 0.42, y: 0.16}
leftHip: {x: 0.58, y: 0.55}
rightHip: {x: 0.42, y: 0.55}
```

**Ghost Alignment Thresholds:**
- Red: average landmark distance > 15% of shoulder width
- Yellow: average landmark distance 8–15% of shoulder width
- Green: average landmark distance < 8% of shoulder width

---

### 10.2 Squat

| Attribute | Value |
|-----------|-------|
| Exercise ID | `squat` |
| Required orientation | Lateral (side-on to camera, either side) |
| Required landmarks (MediaPipe indices) | Shoulder (11 or 12), Hip (23 or 24), Knee (25 or 26), Ankle (27 or 28), Foot index (31 or 32) |
| Default prescription | 10 reps × 3 sets, rest 45s between sets |

**Side Detection:**
The system auto-detects which side faces the camera by comparing visibility scores of left vs right landmarks. The side with higher average visibility is used. `visibleSide = avgVisibility(left landmarks) > avgVisibility(right landmarks) ? 'left' : 'right'`

**Primary Angle Calculations:**
- `kneeAngle` = angle at knee joint formed by hip→knee→ankle vectors. Standing ≈ 170–180°. Full squat ≈ 60–90°.
- `hipAngle` = angle at hip joint formed by shoulder→hip→knee vectors. Standing ≈ 170–180°.
- `backAngle` = angle of shoulder→hip line relative to vertical (0° = perfectly upright). Measured as: `atan2(shoulder.x - hip.x, hip.y - shoulder.y)` in degrees.
- `shinAngle` = angle of knee→ankle line relative to vertical. Measured as: `atan2(knee.x - ankle.x, ankle.y - knee.y)` in degrees.

**Phase Definitions & Thresholds:**

| Phase | Entry Condition | Exit Condition | Hysteresis Band |
|-------|----------------|----------------|-----------------|
| STANDING | `kneeAngle > 160°` | `kneeAngle ≤ 155°` | 5° |
| DESCENT | `kneeAngle ≤ 155°` AND `kneeAngle` is decreasing (angular velocity < -5°/s) | `kneeAngle` stops decreasing (velocity ≥ 0°/s for 200ms) OR `kneeAngle ≤ goldenRepBottom + 5°` | velocity check over 6-frame window |
| BOTTOM_HOLD | `kneeAngle` stable (velocity between -5°/s and +5°/s) AND `kneeAngle < 155°` | `kneeAngle` increasing (velocity > 5°/s for 200ms) | 200ms debounce |
| ASCENT | `kneeAngle` is increasing (velocity > 5°/s) | `kneeAngle > 160°` | 5° |

**Rep Counting Logic:**
One rep = STANDING → DESCENT → BOTTOM_HOLD → ASCENT → STANDING. The BOTTOM_HOLD phase is optional (some patients don't pause at bottom) — if the knee angle transitions directly from decreasing to increasing, the system infers a 0-duration hold and still counts the rep. Minimum descent depth to count: `kneeAngle` must reach at least `goldenRepBottom + 20°` (i.e., within 20° of their calibrated depth).

**Target Depth:** Calibrated from golden rep. For a physiotherapy squat, typical target is 80–100° knee flexion. The system accepts any golden rep depth between 100° and 160° knee angle as valid (shallow squats are fine for rehab patients).

**Form Rules:**

| Rule Name | Check | Threshold | Severity | Voice Feedback | Target Joints | Cooldown | Priority |
|-----------|-------|-----------|----------|---------------|---------------|----------|----------|
| Knee Over Toes | `knee.x` vs `footIndex.x` (lateral view) | knee.x extends > 10% of shin length past foot index | warning | "Keep your knees behind your toes" | 25 or 26 (knee) | 4000ms | form |
| Back Angle | `abs(backAngle - shinAngle)` | > 35° difference | warning | "Keep your back more upright" | 11 or 12 (shoulder) | 4000ms | form |
| Excessive Forward Lean | `backAngle` from vertical | > 55° | error | "Straighten your back" | 11 or 12 (shoulder) | 3000ms | safety |
| Controlled Descent | Knee angular velocity during DESCENT | > 180°/s (dropping too fast) | warning | "Slower, control the movement down" | 25 or 26 (knee) | 5000ms | form |
| Controlled Ascent | Knee angular velocity during ASCENT | > 200°/s (jerking up) | warning | "Come up slowly and controlled" | 25 or 26 (knee) | 5000ms | form |
| Depth Overload | `kneeAngle` during BOTTOM_HOLD or DESCENT | < goldenRepBottom - 15° | error | "That's deep enough, come back up" | 25 or 26 (knee) | 3000ms | safety |
| Knee Collapse (if frontal landmarks partially visible) | Left/right knee x-distance narrows vs baseline | < 70% of baseline knee width | warning | "Push your knees outward" | 25, 26 | 4000ms | form |

**Ghost Pose (Normalized Coordinates):**
Lateral standing position. Coordinates normalized to [0,1] relative to body bounding box:

```
shoulder: {x: 0.45, y: 0.25}
hip: {x: 0.48, y: 0.50}
knee: {x: 0.50, y: 0.72}
ankle: {x: 0.50, y: 0.92}
footIndex: {x: 0.55, y: 0.95}
```

**Ghost Alignment Thresholds:**
- Red: average landmark distance > 20% of torso length (shoulder-to-hip)
- Yellow: average landmark distance 10–20% of torso length
- Green: average landmark distance < 10% of torso length

---

## 11. Biomechanical Algorithm Specifications

### 11.1 Dual Coordinate System

MediaPipe PoseLandmarker returns two separate landmark sets per frame. Using the wrong one causes subtle but critical bugs.

| Output | Coordinate Space | Use For | Never Use For |
|--------|-----------------|---------|---------------|
| `poseLandmarks` | 2D normalized [0,1] relative to image frame | Skeleton overlay rendering, ghost pose alignment, UI hit-testing | Joint angle calculation, velocity profiling, DTW, any biomechanical math |
| `poseWorldLandmarks` | 3D real-world meters, hip-centered | All joint angle calculations, velocity profiling, DTW trajectory, bone length ratios, form rule evaluation | Canvas rendering (coordinates don't map to pixels) |

**Rationale:** `poseLandmarks` are distorted by camera perspective, FOV, and distance from camera. A patient standing far away has compressed joint angles in normalized coords. `poseWorldLandmarks` are in real-world meters regardless of camera position, making angle calculations consistent.

### 11.2 Signal Smoothing (1 Euro Filter)

Replaces standard EMA. The 1 Euro Filter dynamically adjusts smoothing based on movement speed — high smoothing when still (removes jitter), low smoothing when moving fast (removes lag).

**Parameters:**

| Parameter | Value | Effect |
|-----------|-------|--------|
| `minCutoff` | 1.0 Hz | Cutoff frequency when stationary. Lower = more smoothing at rest. |
| `beta` | 0.007 | Speed coefficient. Higher = less lag during fast movement. |
| `dCutoff` | 1.0 Hz | Cutoff for derivative estimation. |

**Per-frame calculation:**
```
// For each landmark coordinate independently:
dx = (x[t] - x[t-1]) / dt          // dt from performance.now() timestamps
edx = lowpass(dx, alpha(dCutoff))   // smoothed derivative
cutoff = minCutoff + beta * abs(edx) // adaptive cutoff
filtered = lowpass(x[t], alpha(cutoff))
```

Where `alpha(cutoff) = 1 / (1 + 1/(2π × cutoff × dt))`

- Applied per-landmark, per-coordinate — 33 landmarks × 3 coordinates = 99 independent filters
- First frame initializes filter state with raw values
- `dt` is derived from `performance.now()` difference between frames (not assumed from FPS)

**Why not EMA:** Standard EMA with fixed α=0.3 introduces ~100ms lag at 30fps. During fast movements (squat descent), this lag causes the system to "see" the patient 3° behind their actual position, triggering false form errors. The 1 Euro Filter eliminates this by reducing smoothing proportionally to movement speed.

### 11.3 Timestamp-Normalized Velocity Profiling

Angular velocity is calculated using real timestamps, not frame counts, to prevent FPS drops from causing false jerk detection.

**Calculation:**
```
velocity[t] = (angle[t] - angle[t - N]) / (timestamp[t] - timestamp[t - N])
```
Where `N` = number of frames in the lookback window, and timestamps are from `performance.now()` in milliseconds.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Lookback window | 6 frames | Adaptive: at 30fps ≈ 200ms, at 15fps ≈ 400ms. The timestamp normalization ensures velocity is correct regardless. |
| Units | degrees/millisecond (°/ms) | Converted to °/s for display and threshold comparison (multiply by 1000) |
| Normal squat descent velocity | 30–120°/s | Literature: controlled squat descent takes 2–3s over ~90° ROM |
| Normal squat ascent velocity | 40–150°/s | Ascent is typically slightly faster than descent |
| Normal neck rotation velocity | 20–90°/s | Slow, controlled head turn over ~70° takes 1–2s |
| Jerk threshold (spike detection) | Velocity changes > 150°/s² (acceleration) within 3 frames | Indicates sudden uncontrolled movement |

**Why timestamp-normalized:** On mobile devices, thermal throttling can drop FPS from 30 to 15 mid-session. With frame-based velocity (`angle_diff / frames × assumed_fps`), a 15fps drop makes normal movement appear 2× faster, triggering false "too fast" warnings. Timestamp normalization eliminates this entirely.

**Smoothness Score (for per-rep scoring):**
```
velocityVariance = variance(velocityProfile) over the rep duration
maxExpectedVariance = (peakVelocity × 0.5)²  // derived from ideal bell-curve
smoothnessScore = max(0, 100 × (1 - velocityVariance / maxExpectedVariance))
```

A perfectly smooth bell-shaped velocity curve scores 100. Jerky, irregular velocity scores lower.

### 11.4 Bone Length Ratio Validation

During calibration, the system captures the patient's skeletal proportions from `poseWorldLandmarks`. These ratios are anatomically fixed — they cannot change during a session. If they do, the frame is distorted.

**Captured Ratios (during baseline):**

| Ratio | Landmarks | Typical Range |
|-------|-----------|---------------|
| Thigh:Shin | hip→knee distance / knee→ankle distance | 0.85–1.15 |
| Upper arm:Forearm | shoulder→elbow / elbow→wrist | 0.90–1.20 |
| Torso:Thigh | shoulder→hip / hip→knee | 0.80–1.30 |

**Runtime Check (every frame):**
```
for each ratio:
  currentRatio = computeRatio(currentWorldLandmarks)
  deviation = abs(currentRatio - baselineRatio) / baselineRatio
  if deviation > 0.20:  // >20% change
    frame.isDistorted = true
```

**When a frame is marked distorted:**
- Skip all form rule evaluation for that frame
- Skip velocity calculation (don't inject a gap into the velocity window)
- Do NOT pause the session or show any UI feedback (distortion is transient, typically 1–3 frames)
- Do NOT count the frame toward hold time
- Log to debug HUD: "Frame skipped: bone ratio distortion"

**Rationale:** When a patient rotates slightly or a limb foreshortens toward the camera, MediaPipe's world landmarks can momentarily warp. Without this check, a perfectly good squat can trigger "knee over toes" for a single distorted frame.

### 11.5 DTW Trajectory Matching

Based on the validated approach from Yu & Xiong (2019, Sensors) — DTW with bone vector angle differences, adapted for MediaPipe world landmarks.

**Input Features (per frame):**
For each exercise, only the critical joint angles are included in the DTW trajectory vector:

| Exercise | DTW Features (per frame) | Dimensions |
|----------|------------------------|------------|
| Neck Rotation | rotationAngle, shoulderTiltAngle, trunkRotationDelta | 3 |
| Squat | kneeAngle, hipAngle, backAngle, shinAngle | 4 |

**Trajectory Sampling:**
- Golden rep trajectory is recorded at full frame rate (30fps) during calibration
- Both golden rep and live rep trajectories are downsampled to 1 sample per 3 frames (10 samples/second) before DTW comparison
- Typical rep trajectory length: 20–60 samples (2–6 seconds per rep)

**DTW Window Constraint:**
- Sakoe-Chiba band with window size `w = ceil(trajectoryLength × 0.15)`
- This constrains warping to ±15% of the trajectory length, preventing pathological alignments while allowing natural speed variation
- Reduces complexity from O(n²) to O(n × w)

**Cost Function:**
```
C(frame_i, frame_j) = sum of abs(angle_i[k] - angle_j[k]) for each dimension k
```
Each angle difference is in degrees. The cost is the sum of absolute angle differences across all dimensions.

**Normalized DTW Score (0–100):**
```
maxAngleDiff = 90  // maximum expected angle difference per dimension
pathLength = length of optimal warping path
dimensions = number of DTW features for the exercise

normalizedDTWDistance = DTW(live, golden) / (maxAngleDiff × dimensions × pathLength)
trajectoryScore = max(0, (1 - normalizedDTWDistance) × 100)
```

**Score Interpretation:**
- 85–100: Movement closely follows golden rep trajectory
- 70–84: Minor deviations (acceptable)
- 50–69: Significant compensation patterns detected
- Below 50: Major deviation from reference movement

### 11.6 Orientation Detection

Determines whether the patient is facing the camera (frontal) or sideways (lateral).

**Calculation:**
```
shoulderPixelDistance = abs(leftShoulder.x - rightShoulder.x)  // in normalized [0,1] coords
shoulderDepthDiff = abs(leftShoulder.z - rightShoulder.z)      // z-axis depth difference
orientationRatio = shoulderPixelDistance / max(shoulderDepthDiff, 0.01)
```

| Orientation | Condition | Rationale |
|-------------|-----------|-----------|
| Frontal | `shoulderPixelDistance > 0.15` AND `orientationRatio > 3.0` | Shoulders are wide in frame, minimal depth difference |
| Lateral | `shoulderPixelDistance < 0.10` OR `orientationRatio < 1.5` | Shoulders are narrow (overlapping), large depth difference |
| Ambiguous (rejected) | Between frontal and lateral thresholds | Voice: "I need you to face me directly" or "Please turn fully sideways" |

The system requires the correct orientation for the selected exercise. If the detected orientation doesn't match the exercise's `requiredOrientation`, the setup step does not advance.

### 11.7 Environmental Check

Performed as Step 0 of setup, before any pose detection. Uses raw video frame analysis.

**Method:**
1. Draw current video frame to a hidden `<canvas>` at reduced resolution (160×120)
2. Read pixel data via `getImageData()`
3. Calculate:
   - `avgBrightness` = mean of all pixel luminance values (0–255), where `luminance = 0.299R + 0.587G + 0.114B`
   - `contrastRatio` = stddev(luminance) / avgBrightness

**Thresholds:**

| Condition | Check | Voice Feedback |
|-----------|-------|---------------|
| Too dark | `avgBrightness < 40` | "Your room is too dark. Please turn on a light." |
| Backlit / silhouetted | `avgBrightness > 220` OR (`avgBrightness > 150` AND `contrastRatio < 0.15`) | "There's a bright light behind you. Please move or adjust your lighting." |
| Acceptable | `avgBrightness` 40–220 AND `contrastRatio > 0.15` | (auto-advance) |

**Behavior:**
- Check runs continuously during Step 0 at 2fps (every 500ms) — no need for high frequency
- Auto-advances after 1.5s of acceptable conditions
- If conditions degrade mid-session (after setup), the system does NOT re-check or pause — environmental check is setup-only. Confidence gating handles mid-session tracking issues.

### 11.8 Visual Hold Ring

A large, unmissable circular progress indicator that fills during hold phases. Serves as the primary visual cue for hold timing and as a fallback when Web Speech API drops audio.

**Specification:**

| Attribute | Value |
|-----------|-------|
| Position | Center of viewport, overlaid on camera feed |
| Size | 200px diameter (desktop), 150px diameter (mobile) |
| Appearance | Circular arc (SVG or Canvas), 8px stroke width, semi-transparent background |
| Color | Follows traffic-light: starts green, turns yellow if form degrades during hold |
| Fill behavior | Arc fills clockwise from 0° to 360° over the hold duration (500ms squat, 1000ms neck rotation) |
| Completion | Ring completes → brief pulse animation (scale 1.0→1.1→1.0, 200ms) → fade out (300ms) |
| Incomplete hold | If patient exits hold phase early, ring freezes at current progress and fades out (300ms) |
| When shown | Only during BOTTOM_HOLD (squat) or LEFT_ROTATION/RIGHT_ROTATION peak hold (neck rotation) |
| Audio sync | Ring fills independently of audio. If voice says "Hold..." and audio freezes, ring still completes. |

---

## 12. Set Transition Behavior

| Attribute | Value |
|-----------|-------|
| Rest period between sets | 30s (neck rotation), 45s (squat) — configurable per exercise definition |
| Rest period UI | Countdown timer displayed prominently. Skeleton overlay hidden. Camera feed remains active. |
| Rest period voice | Set complete: "Set 1 complete. Rest for 30 seconds." At 10s remaining: "10 seconds." At 0s: "Ready? Let's start set 2." |
| Re-calibration between sets | No. Baseline and golden rep from initial calibration persist for the entire session. |
| Early start | If patient begins moving (phase transitions detected) during rest, the rest timer is cancelled and the next set begins immediately. Voice: "Starting set 2." |
| Quit mid-session | Patient can close the browser tab at any time. No confirmation dialog (zero-touch principle). If the session page is navigated away from, camera stream and ML model are released via cleanup in `useEffect` return. |

---

## 13. Correction Card Specifications

| Attribute | Value |
|-----------|-------|
| Max visible | 2 cards simultaneously |
| Position | Bottom-left of viewport, stacked vertically with 8px gap |
| Size | Max width 280px, auto height |
| Card content | Icon (⚠️ warning / 🔴 error) + short text (max 8 words) + affected joint highlighted on skeleton |
| Display duration | Remains visible until the form rule passes again, OR 5 seconds, whichever is shorter |
| Priority when > 2 | Show the most recent card + the highest severity card. If a new card arrives and both slots are full, replace the oldest non-safety card. Safety cards are never replaced by form cards. |
| Animation | Slide in from left (200ms ease-out), fade out (300ms) |
| Card text per form rule | Defined in each exercise's form rule definition (see Section 10) |

---

## 14. Debug HUD Specification

| Attribute | Value |
|-----------|-------|
| Toggle mechanism | Keyboard shortcut `D` key (desktop), triple-tap top-right corner (mobile) |
| Position | Top-right overlay, semi-transparent black background (rgba(0,0,0,0.7)) |
| Content | FPS counter, current FSM state, current phase, all tracked joint angles (°), per-landmark visibility scores, timestamp-normalized angular velocity (°/s) for primary joints, 1 Euro filter cutoff frequencies, bone length ratio deviations (%), frames skipped (distortion), DTW deviation score (last rep), current rep score components, environmental brightness/contrast |
| Update rate | Every frame (synced with pose detection loop) |
| Default state | Hidden |

---

## 15. JSON Session Export Schema

```json
{
  "version": "0.1",
  "exportedAt": "2026-02-28T14:30:00.000Z",
  "exerciseId": "squat",
  "patientProfile": {
    "name": "Patient A",
    "targetReps": 10,
    "targetSets": 3,
    "difficultyModifier": 1.0
  },
  "calibration": {
    "goldenRepDurationMs": 4200,
    "goldenRepAngles": {
      "kneeAngleMin": 88.5,
      "kneeAngleMax": 172.3,
      "hipAngleMin": 75.2,
      "hipAngleMax": 168.1
    },
    "baselinePosture": {
      "standingKneeAngle": 172.3,
      "standingHipAngle": 168.1,
      "standingBackAngle": 4.2,
      "shoulderWidth": 0.28
    },
    "boneLengthRatios": {
      "thighToShin": 1.02,
      "torsoToThigh": 1.05
    },
    "environmentalCheck": {
      "avgBrightness": 128,
      "contrastRatio": 0.42
    },
    "detectedOrientation": "lateral",
    "visibleSide": "left"
  },
  "session": {
    "totalDurationMs": 185000,
    "completedSets": 3,
    "sets": [
      {
        "setNumber": 1,
        "reps": [
          {
            "repNumber": 1,
            "durationMs": 4100,
            "score": {
              "total": 82,
              "rangeOfMotion": 90,
              "formCompliance": 75,
              "smoothness": 85,
              "trajectoryAlignment": 78,
              "holdTime": 70
            },
            "formViolations": ["knee_over_toes"],
            "kneeAngleMin": 92.1,
            "peakVelocity": 95.3
          }
        ],
        "restDurationMs": 45000
      }
    ]
  },
  "summary": {
    "totalReps": 30,
    "averageScore": 79.4,
    "bestRepScore": 95,
    "worstRepScore": 58,
    "mostCommonViolation": "knee_over_toes",
    "averageFPS": 31.2,
    "framesSkippedDistortion": 12
  }
}
```

---

## 16. Haptic Feedback Specification (Mobile Only)

Uses the Vibration API (`navigator.vibrate()`). Gracefully degrades — if API unavailable, haptics are silently skipped.

| Event | Pattern | Duration |
|-------|---------|----------|
| Rep complete | Single pulse | `vibrate(100)` — 100ms |
| Form warning | Double pulse | `vibrate([50, 50, 50])` — 50ms on, 50ms off, 50ms on |
| Form error (safety) | Long pulse | `vibrate(300)` — 300ms |
| Set complete | Triple pulse | `vibrate([100, 80, 100, 80, 100])` — 3 pulses |
| Session complete | Celebration | `vibrate([100, 50, 100, 50, 200])` — escalating |

---

## 17. Camera Configuration

| Attribute | Value |
|-----------|-------|
| getUserMedia constraints | `{ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false }` |
| Resolution | 720p ideal. Accept any resolution ≥ 480p. If device only supports lower, proceed with warning in debug HUD. |
| Facing mode | `user` (front camera) on mobile. On desktop, use default camera. |
| Mirror | Video element is CSS-mirrored (`transform: scaleX(-1)`) for natural interaction. Landmark coordinates are un-mirrored before processing. |
| Cleanup | On component unmount: stop all MediaStream tracks, close PoseLandmarker, cancel any pending `requestAnimationFrame`. |

## 18. Error States & Recovery

| Scenario | Detection Method | System Response | Recovery |
|----------|-----------------|-----------------|----------|
| Backlighting / too dark | Environmental check (Step 0): brightness <40 or >220, contrast <0.15 | Block setup progression. Voice: "Please adjust your lighting." | Auto-advance when conditions acceptable for 1.5s |
| Critical joint occluded | Visibility < 0.65 on required landmark | Pause timer + scoring. Voice (INTERRUPT): "I can't see your [joint] clearly. Please adjust." | Auto-resume when visibility recovers for 1s |
| Patient exits frame | All landmark confidences drop | Pause timer + scoring. Voice (INTERRUPT): "I can't see you. Step back into frame." | Auto-resume when patient detected for 1.5s |
| Perspective distortion | Bone length ratio deviates >20% from baseline | Silently skip frame (no scoring, no feedback, no UI indication) | Automatic — next non-distorted frame resumes normally |
| Audio API crash/freeze | Web Speech API `onerror` or utterance timeout >3s | Visual Hold Ring continues independently. No voice fallback attempted. | Session continues with visual-only feedback until audio recovers |
| Camera permission denied | getUserMedia rejection | Full-screen instruction card with browser-specific steps | Manual retry button |
| Camera in use by another app | getUserMedia error | "Your camera is being used by another application. Please close it and try again." | Manual retry button |
| Browser not supported | Feature detection (MediaPipe WASM) | "Please use Chrome, Safari, or Edge for the best experience." | N/A |
| Low FPS detected | FPS counter drops below 15 | Voice: "Performance is low. Close other tabs for a better experience." Debug HUD shows FPS warning. | Advisory only |

---

## 19. Technical Architecture

### Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | SSR for landing page SEO, client-side for session. TypeScript for safety. |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development with accessible, consistent components |
| Pose Detection | @mediapipe/tasks-vision | 33 3D landmarks, best-in-class browser pose model, WASM-accelerated |
| State | Zustand | Lightweight, no boilerplate, works well with high-frequency pose updates |
| Voice | Web Speech API | Zero dependency, works offline, sufficient quality for short coaching phrases |
| Validation | Zod | Runtime type safety for exercise definitions and configuration |

### Key Architecture Decisions

1. **All processing is client-side.** No server calls during exercise sessions. This ensures privacy (no video leaves the device) and eliminates latency.

2. **COOP/COEP headers enabled.** Required for SharedArrayBuffer which MediaPipe WASM uses for multi-threaded inference. Configured in `next.config.ts`.

3. **Zustand over Context API.** Pose data updates at 30+ FPS. React Context would cause cascading re-renders. Zustand's selector-based subscriptions keep renders surgical.

4. **Declarative exercise definitions.** Each exercise is a data structure (phases, rules, cues), not imperative code. This makes adding exercises a configuration task, not an engineering task.

5. **Swappable validator interface.** The form validation layer is behind an interface, allowing future replacement with an ML-based classifier without changing the engine.

6. **Dual coordinate separation.** `poseLandmarks` (2D normalized) are used exclusively for UI rendering. `poseWorldLandmarks` (3D meters) are used exclusively for all biomechanical calculations. This prevents perspective distortion from corrupting angle math.

7. **1 Euro Filter over EMA.** Standard EMA introduces fixed lag that causes false form errors during fast movements. The 1 Euro Filter adapts dynamically — high smoothing at rest, low smoothing during movement.

8. **Timestamp-normalized velocity.** All velocity calculations use `performance.now()` timestamps, not frame counts. This prevents thermal throttling (FPS drops) from causing false jerk detection on mobile.

### Data Flow

```
Camera → Environmental Check (brightness/contrast)
  → MediaPipe WASM → Raw Landmarks:
      poseLandmarks (2D normalized) → Pose Overlay (Canvas rendering)
      poseWorldLandmarks (3D meters) → 1 Euro Filter → Smoothed World Landmarks
  → Bone Length Ratio Check (reject distorted frames)
  → Pose Store (Zustand) [timestamps from performance.now()]
  ├── → Exercise Engine (FSM)
  │     ├── → Phase Tracker → Rep Counter
  │     ├── → Form Validator → Correction Cards + Joint Colors
  │     ├── → Biomechanics (Timestamp-Velocity + DTW) → Smoothness + Trajectory Scores
  │     └── → Visual Hold Ring (during hold phases)
  └── → Voice Manager (Priority Queue) → SpeechSynthesis
```

---

## 20. Success Metrics (Prototype)

These are qualitative/demo metrics for the prototype. Production metrics would require user studies.

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Rep counting accuracy | >95% (no double-counts or misses over 10 reps) | Manual testing with video recording |
| Form error detection rate | Detects intentional bad form >80% of the time | Tester deliberately performs known errors |
| False positive rate | <10% false form corrections during good-form reps | Tester performs clean reps, count spurious corrections |
| Setup completion rate | >90% of attempts complete setup in <30s | Manual testing across devices |
| Voice feedback relevance | >90% of voice cues are contextually correct | Qualitative review of session recordings |
| FPS on target hardware | ≥30 FPS on M1 MacBook, ≥20 FPS on iPhone 13 | Debug HUD FPS counter |
| Session export completeness | JSON contains all rep scores, durations, calibration | Inspect exported files |

---

## 21. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MediaPipe 3D z-coordinate unreliable for depth | High | Medium | Use z only for supplementary checks (e.g., lateral lean). Primary validation uses 2D angles from the camera's perspective. |
| DTW computation too slow at 30fps | Medium | High | Use windowed DTW (constrain warping to ±15% of trajectory length). Downsample trajectory to 10 keyframes per rep. |
| Golden rep captured from patient with limited mobility is a poor reference | Medium | High | Blend patient's golden rep (70%) with a pre-recorded ideal reference (30%). Flag if patient's golden rep deviates significantly from ideal. |
| Web Speech API voice quality varies across browsers/OS | High | Low | Keep utterances short and simple. Test across Chrome/Safari. Provide mute option. |
| COOP/COEP headers break third-party embeds | Low | Low | Prototype has no third-party embeds. Document the constraint for future development. |
| Patient frustration during setup flow | Medium | High | Auto-advance steps quickly (1.5s threshold). Provide clear, encouraging voice guidance. Allow skipping calibration with default thresholds as fallback. |
| Neck rotation detection less reliable than squat (subtle movement) | Medium | Medium | Use ear-to-shoulder angle ratios rather than absolute positions. Require frontal camera for maximum landmark visibility. |

---

## 22. Future Roadmap (Post-Prototype)

| Version | Features |
|---------|----------|
| v0.2 | 5+ additional exercises (shoulder raises, lunges, bridges, calf raises, arm circles) |
| v0.3 | ML-based form classifier replacing/augmenting rule engine |
| v1.0 | User accounts, exercise prescription by physiotherapist, session history, progress charts |
| v1.1 | Speech recognition for hands-free commands ("pause", "skip", "repeat") |
| v1.2 | Physiotherapist dashboard with remote session review |
| v2.0 | Multi-language voice support, custom exercise builder, clinic white-labeling |

---

## 23. Resolved Design Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Model: `pose_landmarker_full.task` (6MB) vs `lite` (4MB)? | Use `full` | Medical context demands highest accuracy. 6MB is acceptable for a web app. ~2MB difference is negligible vs clinical correctness. |
| 2 | Minimum golden rep quality gate? | Yes — reject if DTW deviation from pre-recorded ideal exceeds 0.40 | Prevents a severely impaired patient's poor rep from becoming the reference. System says: "Let's try that again slowly." Max 3 retries, then fall back to pre-recorded ideal reference. |
| 3 | Mobile orientation? | Lock to portrait | Physio exercises are performed standing/sitting. Portrait maximizes vertical body visibility. Landscape would crop head/feet. |
| 4 | Visibility confidence threshold? | 0.65 | 0.6 is too permissive for medical feedback (allows partially hallucinated joints). 0.7 is too strict (triggers false pauses in normal conditions). 0.65 is the compromise — tested threshold from MediaPipe documentation for "reliable" landmarks. |
| 5 | Allow golden rep re-do? | Yes — patient can retry up to 3 times | Voice: "Would you like to try that again? Stay still to continue, or move to redo." Detect stillness (< 2° movement across all joints for 2s) as "continue" signal. Any deliberate movement within 3s = redo. |

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| 1 Euro Filter | An adaptive low-pass filter that dynamically adjusts smoothing based on signal speed — high smoothing at rest, low smoothing during fast movement. Replaces fixed-alpha EMA. |
| Bone Length Ratio | The ratio between two connected bone segments (e.g., thigh:shin). Anatomically fixed per person — used to detect perspective distortion when ratios deviate from calibrated baseline. |
| Confidence Gating | Pausing feedback when the system's confidence in landmark detection drops below a safe threshold (0.65) |
| DTW | Dynamic Time Warping — an algorithm that measures similarity between two temporal sequences that may vary in speed |
| Dual Coordinates | MediaPipe's two landmark outputs: `poseLandmarks` (2D normalized, for UI) and `poseWorldLandmarks` (3D meters, for physics). Using the wrong one causes perspective distortion in calculations. |
| Environmental Check | Pre-session brightness and contrast analysis to detect backlighting or insufficient lighting before pose detection begins |
| FSM | Finite State Machine — the exercise engine's state model (SETUP → READY → ACTIVE → COMPLETED) |
| Form Rule | A declarative check that evaluates whether a specific aspect of the patient's form is correct |
| Ghost Pose | A semi-transparent skeleton overlay showing the ideal body position the patient should match |
| Golden Rep | A single "perfect" repetition captured during calibration, used as the patient's personalized movement reference |
| Landmark | A specific body point detected by MediaPipe (e.g., left knee, right shoulder). 33 total. |
| Phase | A segment of an exercise movement (e.g., descent, hold, ascent in a squat) |
| Traffic-Light Skeleton | The skeleton overlay where each joint is colored green (good), yellow (warning), or red (error) based on form rules |
| Timestamp-Normalized Velocity | Angular velocity calculated using real `performance.now()` timestamps instead of frame counts, preventing FPS drops from causing false jerk detection |
| Visual Hold Ring | A large circular progress indicator shown during hold phases, serving as both primary visual cue and audio fallback when Web Speech API fails |
