// Global thresholds and configuration constants
// Every magic number in the codebase must trace back to here or an exercise definition.

// --- Pose Detection ---
export const MIN_VISIBILITY_CONFIDENCE = 0.3;
export const MODEL_PATH = '/models/pose_landmarker_full.task';

// --- 1 Euro Filter (see PRD Section 11.2) ---
export const ONE_EURO_MIN_CUTOFF = 0.5;
export const ONE_EURO_BETA = 0.05;
export const ONE_EURO_D_CUTOFF = 1.0;

// --- Velocity Profiling (see PRD Section 11.3) ---
export const VELOCITY_LOOKBACK_FRAMES = 6;
export const JERK_THRESHOLD_DEG_S2 = 150;

// --- Bone Length Ratio (see PRD Section 11.4) ---
export const BONE_RATIO_DEVIATION_THRESHOLD = 0.20;

// --- DTW (see PRD Section 11.5) ---
export const DTW_WINDOW_RATIO = 0.15;
export const DTW_MAX_ANGLE_DIFF = 90;
export const DTW_TRAJECTORY_SAMPLE_INTERVAL = 3; // every 3rd frame

// --- Setup Flow ---
export const SETUP_HOLD_DURATION_MS = 1500;
export const BASELINE_CAPTURE_DURATION_MS = 2000;
export const GOLDEN_REP_MAX_RETRIES = 3;
export const GOLDEN_REP_MAX_DTW_DEVIATION = 0.40;

// --- Environmental Check (see PRD Section 11.7) ---
export const ENV_MIN_BRIGHTNESS = 25;
export const ENV_MAX_BRIGHTNESS = 240;
export const ENV_MIN_CONTRAST_RATIO = 0.15;
export const ENV_CHECK_INTERVAL_MS = 500;

// --- Ghost Pose Alignment ---
export const GHOST_ALIGN_RED_THRESHOLD = 0.15;
export const GHOST_ALIGN_YELLOW_THRESHOLD = 0.08;

// --- Feedback ---
export const MAX_CORRECTION_CARDS = 1;
export const CORRECTION_CARD_TIMEOUT_MS = 5000;
export const SPEECH_UTTERANCE_TIMEOUT_MS = 3000;

// --- Haptics (vibration patterns in ms) ---
export const HAPTIC_REP_COMPLETE = [100];
export const HAPTIC_FORM_WARNING = [50, 50, 50];
export const HAPTIC_FORM_ERROR = [300];
export const HAPTIC_SET_COMPLETE = [100, 80, 100, 80, 100];
export const HAPTIC_SESSION_COMPLETE = [100, 50, 100, 50, 200];

// --- Camera ---
export const CAMERA_WIDTH = 1280;
export const CAMERA_HEIGHT = 720;
export const LOW_FPS_THRESHOLD = 15;

// --- Scoring Weights (see PRD Section 9) ---
export const SCORE_WEIGHT_ROM = 0.25;
export const SCORE_WEIGHT_FORM = 0.30;
export const SCORE_WEIGHT_SMOOTHNESS = 0.20;
export const SCORE_WEIGHT_TRAJECTORY = 0.15;
export const SCORE_WEIGHT_HOLD = 0.10;
