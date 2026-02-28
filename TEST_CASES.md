# DrHealthFit - Test Cases

This document outlines the detailed test cases covering all aspects of the DrHealthFit prototype. These test cases ensure the system's core functionalities—pose detection, setup flow, exercise logic, and feedback mechanisms—are working correctly under various conditions.

## 1. Setup & Environment Flow Tests

### 1.1 Camera Initialization & Permissions
*   **Test Case 1.1.1: Camera Permission Granted**
    *   *Action:* User clicks "Start Exercise" and grants camera permission.
    *   *Expected Result:* The video feed appears on the screen. The MediaPipe model begins downloading/initializing.
*   **Test Case 1.1.2: Camera Permission Denied**
    *   *Action:* User clicks "Start Exercise" and denies camera permission.
    *   *Expected Result:* App shows a clear error message: "Camera access is required. Please enable it in your browser settings and try again." A "Retry" button is provided.
*   **Test Case 1.1.3: No Camera Hardware Detected**
    *   *Action:* User attempts to start an exercise on a device with no connected webcam.
    *   *Expected Result:* App gracefully handles the error and displays "No camera detected. Please connect a webcam."

### 1.2 Environmental Check (Step 0)
*   **Test Case 1.2.1: Ideal Lighting**
    *   *Action:* User stands in a well-lit room with light in front of them.
    *   *Expected Result:* System silently passes the environmental check and proceeds to Step 1.
*   **Test Case 1.2.2: Extreme Backlighting (Silhouetting)**
    *   *Action:* User stands directly in front of a bright window.
    *   *Expected Result:* Setup pauses. Voice and UI prompt: "Your room is too dark, or there is a bright light behind you. Please adjust your lighting."
*   **Test Case 1.2.3: Low Light (Dark Room)**
    *   *Action:* User attempts exercise in a very dark room.
    *   *Expected Result:* Setup pauses. Voice and UI prompt: "Your room is too dark. Please turn on more lights."

### 1.3 Orientation & Alignment (Steps 1 & 2)
*   **Test Case 1.3.1: Incorrect Orientation (Squat)**
    *   *Action:* User selects Squat (side view required) but faces the camera directly.
    *   *Expected Result:* Setup pauses. Voice/UI prompt: "Please turn sideways for this exercise."
*   **Test Case 1.3.2: Partial Visibility**
    *   *Action:* User is too close to the camera, cutting off their legs during the Squat setup.
    *   *Expected Result:* Setup pauses. Voice/UI prompt: "I can't see your whole body. Please step back."
*   **Test Case 1.3.3: Ghost Pose Alignment**
    *   *Action:* User steps into the Ghost Pose outline on screen.
    *   *Expected Result:* The outline color changes from Red -> Yellow -> Green as they align. When green for 1.5 seconds, the setup auto-advances.

### 1.4 Calibration & Golden Rep (Step 3)
*   **Test Case 1.4.1: Successful Baseline Capture**
    *   *Action:* User holds the starting posture still for 2 seconds.
    *   *Expected Result:* System captures baseline metrics (e.g., hip-to-floor height, standing knee angle). Voice: "Great posture."
*   **Test Case 1.4.2: Successful Golden Rep**
    *   *Action:* User performs one slow, correct rep as guided.
    *   *Expected Result:* System records the 3D trajectory. Voice: "Perfect. Starting in 3, 2, 1." App transitions to `ACTIVE` state.
*   **Test Case 1.4.3: Unsteady Baseline**
    *   *Action:* User fidgets constantly during the 2-second baseline capture.
    *   *Expected Result:* System extends the capture time. Voice: "Please hold still a moment longer."

---

## 2. Core Exercise Logic Tests

### 2.1 Rep Counting & Phase Transitions
*   **Test Case 2.1.1: Perfect Full Rep (Squat)**
    *   *Action:* User transitions from `STANDING` -> `BOTTOM` -> `STANDING` passing all angle thresholds.
    *   *Expected Result:* Rep counter increments by 1. The visual rep pulse animation triggers.
*   **Test Case 2.1.2: Shallow Rep (No Count)**
    *   *Action:* User performs a squat but does not reach the calibrated `BOTTOM` threshold.
    *   *Expected Result:* Rep is NOT counted. Voice/UI prompt: "Go a little lower."
*   **Test Case 2.1.3: Hysteresis Boundary**
    *   *Action:* User hovers exactly at the threshold angle between `STANDING` and `BOTTOM`, shaking slightly.
    *   *Expected Result:* The 5-degree hysteresis band prevents the phase from rapidly flickering between states. No false reps are counted.

### 2.2 Hold Timers
*   **Test Case 2.2.1: Successful Hold**
    *   *Action:* User reaches the `LEFT` phase of Neck Rotation (requires 2s hold) and holds still.
    *   *Expected Result:* Visual Hold Ring fills up over 2 seconds. Voice: "Hold... hold... good." Phase completes.
*   **Test Case 2.2.2: Premature Exit**
    *   *Action:* User reaches the `LEFT` phase but returns to center after 0.5 seconds.
    *   *Expected Result:* Visual Hold Ring resets. Rep is NOT counted. Voice: "You need to hold the stretch longer."

---

## 3. Biomechanical & Form Feedback Tests

### 3.1 Velocity & Smoothness Tracking
*   **Test Case 3.1.1: Jerky Movement Detection**
    *   *Action:* User performs a squat rapidly and jerks upwards.
    *   *Expected Result:* Velocity profile spikes. Form rule triggers. Voice: "Slower, control the movement."
*   **Test Case 3.1.2: FPS Drop Resilience**
    *   *Action:* Simulate a frame rate drop to 10 FPS while user performs a normal, smooth squat.
    *   *Expected Result:* Because velocity is timestamp-normalized, the system correctly identifies it as a smooth movement. NO "Slower" warning is triggered.

### 3.2 Dynamic Time Warping (DTW) Trajectory
*   **Test Case 3.2.1: Lateral Shift (Squat)**
    *   *Action:* User performs a squat but shifts their hips heavily to the left, deviating from their Golden Rep trajectory.
    *   *Expected Result:* DTW distance exceeds threshold. Voice: "Try to stay centered, don't shift your weight."

### 3.3 Static Form Rules
*   **Test Case 3.3.1: Back Rounding (Safety Priority)**
    *   *Action:* User's torso lean angle exceeds 45 degrees during a squat.
    *   *Expected Result:* IMMEDIATE INTERRUPT. Voice: "Keep your chest up, back straight!" The shoulder and hip joints on the skeleton overlay turn **RED**.
*   **Test Case 3.3.2: Knee Over Toes**
    *   *Action:* User's knee x-coordinate extends significantly past ankle x-coordinate.
    *   *Expected Result:* Voice: "Don't let your knees go past your toes." Knee and ankle joints turn **YELLOW/RED**.

---

## 4. Error Recovery & Edge Cases

### 4.1 Occlusion & Confidence Gating
*   **Test Case 4.1.1: Limb Occlusion**
    *   *Action:* User hides their right arm behind their back during an exercise requiring it.
    *   *Expected Result:* Landmark confidence drops < 0.6. Scoring pauses. Voice: "I can't see your right arm clearly."
*   **Test Case 4.1.2: Leaving the Frame**
    *   *Action:* User walks entirely out of the camera view mid-exercise.
    *   *Expected Result:* Exercise state pauses. Timer stops. Voice: "I can't see you. Step back into frame."
*   **Test Case 4.1.3: Returning to Frame**
    *   *Action:* User returns to the frame after leaving.
    *   *Expected Result:* System requires a brief "Starting Posture" check to ensure alignment, then automatically resumes the active rep count.

### 4.2 Perspective Distortion
*   **Test Case 4.2.1: Severe Foreshortening**
    *   *Action:* User rotates their body 45-degrees towards the camera during a side-view squat, distorting the perceived leg length.
    *   *Expected Result:* The Bone Length Ratio check detects the physical impossibility of the leg shrinking. The frame is rejected. If sustained, voice: "Please turn completely sideways."

---

## 5. UI, Audio & Export Tests

### 5.1 Voice Priority System
*   **Test Case 5.1.1: Interrupt vs Queue**
    *   *Action:* System is currently speaking "Rep 3 complete." User immediately rounds their back dangerously.
    *   *Expected Result:* The "Rep 3" speech is instantly cut off. System immediately speaks "Straighten your back!"
*   **Test Case 5.1.2: Cooldowns**
    *   *Action:* User continuously performs shallow squats.
    *   *Expected Result:* System says "Go a little lower" once. It does NOT repeat the phrase on the very next rep due to the 4-second cooldown, preventing annoying nagging.

### 5.2 End of Session Export
*   **Test Case 5.2.1: JSON Export Validity**
    *   *Action:* User completes a session and clicks "Download Session Data".
    *   *Expected Result:* A valid JSON file is downloaded containing rep arrays, timestamps, form scores (0-100), and calibration baselines. No PII is included.
