/**
 * FSM Types and Interfaces for Deterministic Exercise Form & Fraud Validation Engine
 */

export type FSMState = 'INIT' | 'UP' | 'DOWN' | 'VALID_REP';

export type InvalidRepReason =
  | 'HALF_REP_INCOMPLETE_ROM'
  | 'ASYMMETRIC_FORM'
  | 'LOW_VISIBILITY';

export interface ExerciseFSMConfig {
  /** Type of exercise (e.g. 'pushup', 'squat') */
  exerciseType: string;
  /** Maximum joint angle required for DOWN state (e.g. <= 90 deg) */
  downAngleThreshold: number;
  /** Minimum joint angle required for UP state (e.g. >= 160 deg) */
  upAngleThreshold: number;
  /** Maximum allowable bilateral asymmetry between left and right limbs (default 15 deg) */
  maxAsymmetryDeg: number;
  /** Minimum required visibility confidence score (default 0.5) */
  minVisibility: number;
}

export interface KinematicFrameData {
  timestampMs: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
  visibilityScore?: number;
}

export interface RepetitionRecord {
  repIndex: number;
  timestampMs: number;
  durationMs: number;
  isValid: boolean;
  minLeftAngle: number;
  minRightAngle: number;
  maxAsymmetryDeg: number;
  invalidReason?: InvalidRepReason;
}

export interface FSMFrameResult {
  state: FSMState;
  validReps: number;
  invalidReps: number;
  totalAttempts: number;
  repCompleted: boolean;
  lastRepRecord?: RepetitionRecord;
  feedbackMessage: string;
  formAccuracyPercent: number;
}

export interface SetRecord {
  setIndex: number;
  repsCount: number;
  validRepsCount: number;
  accuracyPercent: number;
  durationSec: number;
  avgAsymmetryDeg: number;
  repetitionIndices: number[];
}

export interface SetAnalysisResult {
  totalSets: number;
  sets: SetRecord[];
  setVolumeDelta?: number;
  accuracyRetentionPercent?: number;
  summaryText: string;
}
