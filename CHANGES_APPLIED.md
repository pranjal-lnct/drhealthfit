# Changes Applied - Neck Rotation Rep Counting Fixes

## Summary
Fixed critical bugs preventing reliable rep counting in the neck rotation exercise by widening phase thresholds, preventing dead zones, and improving initial state.

---

## Changes Made

### 1. **src/core/exercises/neck-rotation.ts** - Widen Phase Thresholds

**Lines 6-12**: Updated threshold constants
```typescript
// BEFORE
const CENTER_THRESHOLD = 8;       // must return within 8° to be "centered"
const ROTATION_ENTRY_THRESHOLD = 14; // must reach 14° to count as a rotation

// AFTER
const CENTER_THRESHOLD = 10;         // must return within 10° to be "centered"
const ROTATION_EXIT_THRESHOLD = 10;  // can exit rotation when within 10° of center (NEW)
const ROTATION_ENTRY_THRESHOLD = 20; // must reach 20° to count as a rotation (increased for stability)
```

**Impact**:
- Increased dead zone from 6° to 10° to reduce phase flickering from camera noise
- Added separate exit threshold to prevent "no active phase" gaps

---

**Lines 51-67**: Updated phase exit conditions
```typescript
// BEFORE
{
  name: 'LEFT_ROTATION',
  exit: (angles) => (angles.rotationAngle ?? 0) > -CENTER_THRESHOLD,  // -8°
}
{
  name: 'RIGHT_ROTATION',
  exit: (angles) => (angles.rotationAngle ?? 0) < CENTER_THRESHOLD,   // +8°
}

// AFTER
{
  name: 'LEFT_ROTATION',
  exit: (angles) => (angles.rotationAngle ?? 0) > -ROTATION_EXIT_THRESHOLD,  // -10°
}
{
  name: 'RIGHT_ROTATION',
  exit: (angles) => (angles.rotationAngle ?? 0) < ROTATION_EXIT_THRESHOLD,   // +10°
}
```

**Impact**: Ensures CENTER phase (abs < 10°) and ROTATION exit (at ±10°) overlap, preventing dead zones

---

### 2. **src/hooks/use-exercise-session.ts** - Force Initial CENTER Phase

**Lines 233-245**: Added initial phase setup
```typescript
// BEFORE
engine.phaseSequence = []; // No seed needed

// AFTER
engine.currentPhase = 'CENTER';
engine.phaseSequence = ['CENTER'];
useExerciseStore.getState().setPhase('CENTER');  // Force store to show CENTER
```

**Impact**: Ensures the phase sequence always starts with CENTER, matching the required pattern

---

### 3. **src/hooks/use-exercise-session.ts** - Relax Distortion Check

**Lines 324-329**: Added lenient threshold for neck rotation
```typescript
// BEFORE
isDistorted = isFrameDistorted(currentRatios, baselineRef.current.boneLengthRatios);

// AFTER
const distortionThreshold = exercise.id === 'neck-rotation' ? 0.35 : undefined;
isDistorted = isFrameDistorted(currentRatios, baselineRef.current.boneLengthRatios, distortionThreshold);
```

**Impact**: Reduces "Skipping distorted frame" messages since head rotation doesn't actually distort body bone ratios

---

### 4. **src/core/exercise/exercise-engine.ts** - Seed Next Rep with Current Phase

**Lines 226-229**: Changed phase sequence reset behavior
```typescript
// BEFORE
engine.phaseSequence = [];

// AFTER
engine.phaseSequence = [engine.currentPhase];
```

**Impact**: After a rep completes, the next rep starts with the current phase in the sequence, ensuring continuity

---

### 5. **src/core/pose/biomechanics.ts** - Add Optional Threshold Parameter

**Lines 88-100**: Made threshold customizable
```typescript
// BEFORE
export function isFrameDistorted(
  current: BoneLengthRatios,
  baseline: BoneLengthRatios,
): boolean {
  const check = (cur: number, base: number) =>
    Math.abs(cur - base) / Math.max(base, 0.01) > BONE_RATIO_DEVIATION_THRESHOLD;

// AFTER
export function isFrameDistorted(
  current: BoneLengthRatios,
  baseline: BoneLengthRatios,
  threshold: number = BONE_RATIO_DEVIATION_THRESHOLD,  // NEW optional parameter
): boolean {
  const check = (cur: number, base: number) =>
    Math.abs(cur - base) / Math.max(base, 0.01) > threshold;
```

**Impact**: Allows per-exercise customization of distortion tolerance

---

## Expected Improvements

### Before Fixes:
- ❌ Phase sequence: `RIGHT_ROTATION → CENTER → LEFT_ROTATION → CENTER` (doesn't match)
- ❌ Phases flickering: `CENTER → LEFT → CENTER → RIGHT → CENTER` in 2 seconds
- ❌ Dead zones at ±9° where no phase is active
- ❌ Many frames skipped as "distorted"
- ❌ Reps rarely counting due to sequence mismatch

### After Fixes:
- ✅ Phase sequence: `CENTER → LEFT_ROTATION → CENTER → RIGHT_ROTATION → CENTER` (matches!)
- ✅ Stable phases: Must move 20° to enter rotation, can return to center at 10°
- ✅ No dead zones: Center (< 10°) overlaps with rotation exit (±10°)
- ✅ Fewer skipped frames with 35% distortion tolerance
- ✅ Reps count reliably when user turns left and right

---

## Testing Instructions

1. **Start the app**: Navigate to http://localhost:3000/session/neck-rotation
2. **Click "Start Exercise"**
3. **Face forward** - You should see phase: CENTER
4. **Turn left slowly** (past 20°) - Phase should change to LEFT_ROTATION
5. **Return to center** (within 10°) - Phase should return to CENTER
6. **Turn right slowly** (past 20°) - Phase should change to RIGHT_ROTATION
7. **Return to center** (within 10°) - **Rep should count as 1!**

**Expected Result**: Clear, stable phase transitions with rep counting on first complete cycle.

---

## Debug Tips

If reps still don't count:
1. Check the debug overlay (shows current rotation angle)
2. Ensure rotation angle reaches at least ±20° for rotations
3. Verify you're returning to < 10° when centering
4. Check console for phase sequence - should show all phases in order

The debug overlay shows:
- `rotationAngle`: Current head rotation (-90 to +90)
- `absRotation`: Absolute value of rotation
- `Seq`: Recent phase sequence

A successful rep sequence should look like:
`CENTER → LEFT_ROTATION → CENTER → RIGHT_ROTATION → CENTER`
or
`CENTER → RIGHT_ROTATION → CENTER → LEFT_ROTATION → CENTER`

---

## Additional Notes

- The exercise now accepts **either direction first** (left or right) due to `repSequenceAlternate`
- The fuzzy matching algorithm already handles minor sequence variations
- Phases now have proper hysteresis (different enter/exit thresholds) to prevent oscillation
- Distortion check is now exercise-aware for better performance on head-only movements
