# Neck Rotation Rep Counting Fixes

## Issues Identified from Live Testing

### Issue 1: Phase Sequence Never Matches (CRITICAL)
**Current Behavior:**
- Sequence starts with: `RIGHT_ROTATION → CENTER → LEFT_ROTATION...`
- Required sequence: `['CENTER', 'LEFT_ROTATION', 'CENTER', 'RIGHT_ROTATION', 'CENTER']`
- **Mismatch**: First element is wrong, so reps never count

**Root Cause:**
In `use-exercise-session.ts` line 239:
```typescript
engine.phaseSequence = ['CENTER']; // Seed with initial phase
```
But the user's head is not perfectly centered (rotation angle varies), so it immediately transitions to LEFT_ROTATION or RIGHT_ROTATION before the sequence matching begins.

**Fix 1A - Force Initial CENTER Phase (Quick Fix):**
```typescript
// In use-exercise-session.ts, line 233-240
const engine = engineRef.current;
engine.state = 'ACTIVE';
engine.setupStep = 'CALIBRATION';
engine.repStartMs = performance.now();
engine.sets = [{ setNumber: 1, reps: [], restDurationMs: 0 }];

// Force start in CENTER phase by setting it explicitly
engine.currentPhase = 'CENTER';
engine.phaseSequence = ['CENTER'];

useExerciseStore.getState().setSetupStep('CALIBRATION');
useExerciseStore.getState().setEngineState('ACTIVE');
useExerciseStore.getState().setPhase('CENTER'); // Add this line
```

**Fix 1B - Allow Flexible Starting Phase (Better):**
Modify the rep sequence matching to ignore the first phase:

```typescript
// In exercise-engine.ts, processFrame() around line 195
if (seq.length >= repSeq.length) {
  const tail = seq.slice(seq.length - repSeq.length);
  const matches = tail.every((p, i) => p === repSeq[i]);

  if (matches) {
    // Rep matched!
  }
}

// Replace with:
if (seq.length >= repSeq.length - 1) { // Allow one less for starting phase
  // Try matching from any offset
  let matched = false;

  // Try exact match
  if (seq.length >= repSeq.length) {
    const tail = seq.slice(seq.length - repSeq.length);
    matched = tail.every((p, i) => p === repSeq[i]);
  }

  // If not matched and sequence is long enough, try fuzzy match
  // For neck rotation, just need: LEFT_ROTATION → CENTER → RIGHT_ROTATION → CENTER
  if (!matched && exercise.id === 'neck-rotation') {
    // Find if we have the pattern: LEFT_ROT, CENTER, RIGHT_ROT, CENTER
    const leftIdx = seq.lastIndexOf('LEFT_ROTATION');
    if (leftIdx >= 0 && leftIdx + 3 < seq.length) {
      const pattern = seq.slice(leftIdx, leftIdx + 4);
      matched = pattern[0] === 'LEFT_ROTATION' &&
                pattern[1] === 'CENTER' &&
                pattern[2] === 'RIGHT_ROTATION' &&
                pattern[3] === 'CENTER';
    }
  }

  if (matched) {
    // Rep counted!
  }
}
```

---

### Issue 2: Phase Thresholds Too Sensitive (CRITICAL)

**Current Values** (in `neck-rotation.ts`):
```typescript
const CENTER_THRESHOLD = 8;           // Must be < 8° to be CENTER
const ROTATION_ENTRY_THRESHOLD = 12;  // Must be > 12° to enter rotation
```

**Problem**: Only 4° dead zone between CENTER and ROTATION states

**Evidence from logs:**
- Rotation angle jumping: `6.3° → 11.6° → 2.5° → 13.9° → 1.4°`
- Phases flickering: `CENTER → LEFT → CENTER → RIGHT → CENTER` in rapid succession

**Fix 2 - Increase Dead Zone:**
```typescript
// In neck-rotation.ts, lines 7-8
const CENTER_THRESHOLD = 5;            // Tighter center zone
const ROTATION_ENTRY_THRESHOLD = 20;   // Wider entry threshold (was 12)

// This creates a 15° dead zone instead of 4°
```

**Additionally - Add Hysteresis:**
```typescript
// In neck-rotation.ts, update phase definitions
const CENTER_EXIT_THRESHOLD = 15;     // Need to go 15° to exit CENTER
const ROTATION_RETURN_THRESHOLD = 8;  // Can return to CENTER at 8°

phases: [
  {
    name: 'CENTER',
    enter: (angles) => (angles.absRotation ?? 0) < ROTATION_RETURN_THRESHOLD,
    exit: (angles) => (angles.absRotation ?? 0) >= CENTER_EXIT_THRESHOLD,
  },
  {
    name: 'LEFT_ROTATION',
    enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) <= -ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) > -ROTATION_RETURN_THRESHOLD,
  },
  {
    name: 'RIGHT_ROTATION',
    enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) >= ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) < ROTATION_RETURN_THRESHOLD,
  },
]
```

---

### Issue 3: Phase Exit Conditions Wrong

**Current Problem:**
Looking at the phase definitions in `neck-rotation.ts`:

```typescript
{
  name: 'LEFT_ROTATION',
  enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) <= -ROTATION_ENTRY_THRESHOLD,
  exit: (angles) => (angles.rotationAngle ?? 0) > -CENTER_THRESHOLD,  // Exits when > -8°
}
```

This means:
- Enter LEFT_ROTATION at: rotation ≤ -12°
- Exit LEFT_ROTATION at: rotation > -8°

But CENTER enters at: `absRotation < 8°`

**Issue**: User at -9° is not in LEFT_ROTATION (exited) and not in CENTER (absRotation = 9° > 8°)
→ **No active phase! System is lost!**

**Fix 3 - Overlap Phase Boundaries:**
```typescript
// Ensure phases overlap so there's always an active phase
const CENTER_THRESHOLD = 10;           // Can be in CENTER if abs < 10°
const ROTATION_EXIT_THRESHOLD = 10;    // Exit rotation when abs < 10°
const ROTATION_ENTRY_THRESHOLD = 20;   // Enter rotation when abs > 20°

phases: [
  {
    name: 'CENTER',
    enter: (angles) => (angles.absRotation ?? 0) < CENTER_THRESHOLD,
    exit: (angles) => (angles.absRotation ?? 0) >= ROTATION_ENTRY_THRESHOLD,
  },
  {
    name: 'LEFT_ROTATION',
    enter: (angles, prev) =>
      prev === 'CENTER' && (angles.rotationAngle ?? 0) <= -ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) > -ROTATION_EXIT_THRESHOLD,
  },
  {
    name: 'RIGHT_ROTATION',
    enter: (angles, prev) =>
      prev === 'CENTER' && (angles.rotationAngle ?? 0) >= ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) < ROTATION_EXIT_THRESHOLD,
  },
]
```

---

### Issue 4: Too Many Distorted Frames

**Evidence:** Logs show frequent "Skipping distorted frame" messages

**Cause:** Bone length ratio distortion check is too strict when user moves head

**Fix 4 - Relax Distortion Check for Neck Exercises:**
```typescript
// In use-exercise-session.ts, around line 321-325
let isDistorted = false;
if (baselineRef.current) {
  const currentRatios = computeBoneLengthRatios(filteredWorld);
  // For neck rotation, be more lenient with distortion since head moves
  const distortionThreshold = exercise.id === 'neck-rotation'
    ? 0.30  // 30% tolerance for neck rotation
    : BONE_RATIO_DEVIATION_THRESHOLD; // 20% for others
  isDistorted = isFrameDistorted(currentRatios, baselineRef.current.boneLengthRatios, distortionThreshold);
}
```

Or modify `isFrameDistorted` in `biomechanics.ts`:
```typescript
export function isFrameDistorted(
  current: BoneLengthRatios,
  baseline: BoneLengthRatios,
  threshold: number = BONE_RATIO_DEVIATION_THRESHOLD,
): boolean {
  // ... existing code
}
```

---

## Recommended Implementation Order

### Phase 1 - Critical Fixes (Do These First)
1. ✅ **Fix Phase Thresholds** (neck-rotation.ts)
   - Increase ROTATION_ENTRY_THRESHOLD from 12° to 20°
   - Add hysteresis with separate enter/exit thresholds

2. ✅ **Fix Phase Boundaries** (neck-rotation.ts)
   - Ensure CENTER and ROTATION phases overlap
   - Prevent "no active phase" dead zones

3. ✅ **Force Initial CENTER Phase** (use-exercise-session.ts)
   - Set engine.currentPhase = 'CENTER' on start
   - Update store to reflect CENTER phase

### Phase 2 - Important Improvements
4. ✅ **Flexible Rep Sequence Matching** (exercise-engine.ts)
   - Allow sequence to match even if starting phase differs
   - Implement fuzzy matching for neck rotation

5. ✅ **Relax Distortion Check** (use-exercise-session.ts)
   - Increase tolerance for neck rotation exercise
   - Reduce skipped frames

---

## Quick Test After Fixes

After implementing Phase 1 fixes:

1. Start neck rotation exercise
2. Face forward (should show CENTER)
3. Turn left slowly (should enter LEFT_ROTATION around 20°)
4. Return to center (should re-enter CENTER around 10°)
5. Turn right slowly (should enter RIGHT_ROTATION around 20°)
6. Return to center (should complete rep and count as 1)

**Expected:** Rep counts on first try with clear phase transitions

---

## Code Changes Summary

### File: `src/core/exercises/neck-rotation.ts`

```typescript
// Lines 7-12 - Update thresholds
const CENTER_THRESHOLD = 10;              // ← Changed from 8
const ROTATION_EXIT_THRESHOLD = 10;       // ← NEW
const ROTATION_ENTRY_THRESHOLD = 20;      // ← Changed from 12
const SHOULDER_TILT_THRESHOLD = 0.20;
const MAX_ROTATION_VELOCITY = 120;
const HYPERMOBILITY_ABSOLUTE = 95;
const HYPERMOBILITY_MARGIN = 10;

// Lines 51-67 - Update phase definitions
phases: [
  {
    name: 'CENTER',
    enter: (angles) => (angles.absRotation ?? 0) < CENTER_THRESHOLD,
    exit: (angles) => (angles.absRotation ?? 0) >= ROTATION_ENTRY_THRESHOLD,
  },
  {
    name: 'LEFT_ROTATION',
    enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) <= -ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) > -ROTATION_EXIT_THRESHOLD,  // ← Changed
  },
  {
    name: 'RIGHT_ROTATION',
    enter: (angles, prev) => prev === 'CENTER' && (angles.rotationAngle ?? 0) >= ROTATION_ENTRY_THRESHOLD,
    exit: (angles) => (angles.rotationAngle ?? 0) < ROTATION_EXIT_THRESHOLD,  // ← Changed
  },
],
```

### File: `src/hooks/use-exercise-session.ts`

```typescript
// Line 240 - Force initial phase
engine.phaseSequence = ['CENTER'];
useExerciseStore.getState().setSetupStep('CALIBRATION');
useExerciseStore.getState().setEngineState('ACTIVE');
useExerciseStore.getState().setPhase('CENTER');  // ← ADD THIS LINE
```

These minimal changes should immediately improve rep counting reliability!
