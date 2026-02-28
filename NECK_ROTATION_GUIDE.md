# Neck Rotation Visual Guide - Implementation

## What Was Added

A **visual rotation arc guide** that shows users exactly where their head should be positioned during the neck rotation exercise.

## Component Created

**File**: `src/components/exercise/neck-rotation-guide.tsx`

### Visual Features:

#### 1. **Semi-Circular Arc Display**
- Positioned at the top center of the screen
- Shows the full range of motion (-90° to +90°)
- Color-coded zones for easy understanding

#### 2. **Color-Coded Zones**

**Green Target Zones** (Left & Right)
- Left: -90° to -20°
- Right: +20° to +90°
- Shows where the user should rotate to for a valid rep
- Pulsing green dots mark the exact ±20° entry points

**Blue Center Zone**
- -10° to +10°
- Shows the neutral/center position
- User should return here between rotations
- Blue dot marks the exact 0° center point

**Gray Transition Areas**
- -20° to -10° and +10° to +20°
- Areas between center and target zones

#### 3. **Moving Position Indicator**
- **Large animated circle** that follows your head rotation in real-time
- Shows current angle as a number below the arc
- Changes color based on phase:
  - **Blue**: When centered (CENTER phase)
  - **Green**: When in target zone (LEFT_ROTATION or RIGHT_ROTATION phase)
  - **Gray**: Default state
- **Pulses** when you reach a target zone or return to center

#### 4. **Real-Time Feedback**
Displays status messages:
- "✓ Centered" - When within ±10° of center
- "✓ Left Target Reached" - When rotated left past -20°
- "✓ Right Target Reached" - When rotated right past +20°

#### 5. **Labels**
- "← LEFT" on the left arc
- "RIGHT →" on the right arc
- "CENTER" at the top
- Current angle displayed in large numbers (e.g., "23°")

---

## How It Works

### Visual Guidance Flow:

```
START: Head centered (0°)
  ↓
  Blue indicator at center
  "✓ Centered" message
  ↓
TURN LEFT: Rotate head left
  ↓
  Indicator moves left along arc
  Angle decreases: 0° → -10° → -20°
  ↓
AT -20°: Target reached!
  ↓
  Indicator turns GREEN
  "✓ Left Target Reached"
  Green zone lights up
  ↓
RETURN: Turn back to center
  ↓
  Indicator moves right
  Angle increases: -20° → -10° → 0°
  ↓
AT 0°: Centered again
  ↓
  Indicator turns BLUE
  "✓ Centered" message
  ↓
TURN RIGHT: Rotate head right
  ↓
  Indicator moves right along arc
  Angle increases: 0° → +10° → +20°
  ↓
AT +20°: Target reached!
  ↓
  Indicator turns GREEN
  "✓ Right Target Reached"
  Green zone lights up
  ↓
RETURN: Turn back to center
  ↓
  REP COUNTED! ✅
```

---

## User Benefits

### Before (Without Guide):
❌ "How far should I turn?"
❌ "Am I turning enough?"
❌ "Did I return to center properly?"
❌ "Why didn't my rep count?"

### After (With Guide):
✅ **Visual target zones** show exactly where to rotate
✅ **Real-time position indicator** shows current angle
✅ **Clear feedback** when targets are reached
✅ **Angle display** shows precise rotation (e.g., "23°")
✅ **Status messages** confirm proper form
✅ **Color coding** makes it intuitive (blue = center, green = target)

---

## Technical Details

### Constants (Matching neck-rotation.ts):
- `CENTER_THRESHOLD = 10°` - Must be within ±10° to be centered
- `ROTATION_TARGET = 20°` - Must reach ±20° to enter rotation phase
- `MAX_ROTATION = 90°` - Maximum expected rotation

### Arc Specifications:
- **Radius**: 120px
- **Arc Width**: 16px
- **Position**: Top-center of screen (200px from left, 180px from top)
- **Animation**: Smooth 100ms transitions for indicator movement
- **Responsiveness**: Pointer-events disabled (won't block camera view)

### SVG Elements:
1. **Background arc** (white, 20% opacity) - Full range
2. **Left green zone** (green, 40% opacity) - -90° to -20°
3. **Right green zone** (green, 40% opacity) - +20° to +90°
4. **Center blue zone** (blue, 60% opacity) - -10° to +10°
5. **Target markers** (green circles at ±20°, pulsing)
6. **Center marker** (blue circle at 0°)
7. **Position indicator** (large circle with glow, 12px inner + 20px outer)

---

## Integration

The guide is **automatically shown only for neck rotation exercises**:

```typescript
{exerciseId === 'neck-rotation' && (
  <>
    <NeckRotationGuide />  // ← NEW Arc Guide
    <NeckGuideArrow />     // ← Existing arrow
  </>
)}
```

### Data Source:
- Gets `rotationAngle` from `useExerciseStore` → `debugMetrics.currentAngles.rotationAngle`
- Updates in real-time as pose detection runs
- Synced with phase changes (CENTER, LEFT_ROTATION, RIGHT_ROTATION)

---

## Testing the Guide

### To See the Arc Guide:

1. **Navigate** to http://localhost:3000/session/neck-rotation
2. **Click** "Start Exercise"
3. **Allow** camera permission
4. **Look for** the semi-circular arc at the top of the screen

### Expected Behavior:

**When facing forward (0°):**
- Blue indicator at center top
- Message: "✓ Centered"
- Angle shows: "0°" or close to it

**When turning left:**
- Indicator moves counterclockwise along arc
- Angle becomes negative: "-5°", "-12°", "-18°"
- At -20°: Green indicator, "✓ Left Target Reached"

**When turning right:**
- Indicator moves clockwise along arc
- Angle becomes positive: "+5°", "+12°", "+18°"
- At +20°: Green indicator, "✓ Right Target Reached"

**Complete rep cycle:**
- Start: Center (blue)
- Turn left to -20° (green)
- Return to center (blue)
- Turn right to +20° (green)
- Return to center (blue)
- **Rep counts!** ✅

---

## Customization Options

If you want to adjust the guide, you can modify these values in `neck-rotation-guide.tsx`:

### Position:
```typescript
const centerX = 200;  // Horizontal position
const centerY = 180;  // Vertical position from top
```

### Size:
```typescript
const radius = 120;   // Arc radius
const arcWidth = 16;  // Thickness of arc
```

### Visual Style:
```typescript
// Colors
'#22c55e40' // Green zones (40% opacity)
'#60a5fa60' // Blue center (60% opacity)
'#ffffff20' // Background arc (20% opacity)

// Indicator sizes
r="12"  // Inner indicator circle
r="20"  // Outer glow circle
r="8"   // Target markers
r="6"   // Center marker
```

---

## Accessibility

- **High contrast** colors (white on black background)
- **Multiple feedback types**:
  - Visual (colors, movement)
  - Textual (status messages, angle numbers)
  - Positional (arc guides, markers)
- **Drop shadows** for readability over video
- **Large text** for angle display (28px)
- **Smooth animations** (100ms transitions, not jarring)

---

## Performance

- **Lightweight SVG** rendering
- **CSS animations** (hardware accelerated)
- **Conditional rendering** (only for neck-rotation exercise)
- **Optimized updates** (transition duration prevents excessive redraws)
- **No blocking** (pointer-events: none)

---

## Next Steps

1. **Test the guide** by running the neck rotation exercise
2. **Adjust positioning** if it overlaps with other UI elements
3. **Gather user feedback** on clarity and helpfulness
4. **Consider adding**:
   - Sound feedback when targets are reached
   - Haptic vibration on mobile devices
   - Optional "compact mode" for smaller screens
   - Similar guides for other exercises (squat depth indicator, etc.)

---

## Summary

The **Neck Rotation Visual Guide** provides:
- ✅ Clear visual target zones
- ✅ Real-time position tracking
- ✅ Instant feedback on form
- ✅ Intuitive color coding
- ✅ Precise angle measurements
- ✅ Smooth, non-intrusive animations

This should significantly improve the user experience and make it much easier to perform the neck rotation exercise correctly!
