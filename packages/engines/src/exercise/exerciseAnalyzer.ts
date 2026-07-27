import { calculate3DVectorAngle, calculateBilateralSymmetry } from '../kinematics/vectorGeometry.js';
import { createExerciseFSM } from '../fsm/exerciseFSM.js';
import { detectFatigueBreakdown, type FatigueAnalysisResult } from '../analytics/fatigueTracker.js';
import type { Landmark, PoseFrame } from '../jump/types.js';
import type { Landmark3D } from '../kinematics/types.js';
import type { RepetitionRecord } from '../fsm/types.js';

export type ExerciseTestType = 'vertical_jump' | 'pushup' | 'squat';

export interface PastSessionSummary {
  validReps?: number;
  formAccuracyPercent?: number;
  avgAsymmetryDeg?: number;
  jumpHeightM?: number;
}

export interface PastImprovementResult {
  hasPastData: boolean;
  repDelta?: number;
  accuracyDeltaPercent?: number;
  asymmetryDeltaDeg?: number;
  summaryText: string;
}

export interface ExerciseAnalysisResult {
  ok: boolean;
  exerciseType: ExerciseTestType;
  exerciseName: string;
  metrics: {
    totalAttempts: number;
    validReps: number;
    invalidReps: number;
    formAccuracyPercent: number;
    avgMinAngleDeg: number;
    avgMaxAsymmetryDeg: number;
    durationSec: number;
    fatigueDetected: boolean;
    tempoSlowdownFactor: number;
  };
  repHistory: RepetitionRecord[];
  fatigueAnalysis: FatigueAnalysisResult;
  pointsToImprove: string[];
  pastImprovement: PastImprovementResult;
}

function toLandmark3D(lm: Landmark): Landmark3D {
  return {
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility,
  };
}

/**
 * Analyzes a frame sequence for Push-Up performance.
 */
export function analyzePushups(
  frames: PoseFrame[],
  pastSession?: PastSessionSummary
): ExerciseAnalysisResult {
  const fsm = createExerciseFSM({
    exerciseType: 'pushup',
    downAngleThreshold: 90.0,
    upAngleThreshold: 160.0,
    maxAsymmetryDeg: 15.0,
  });

  const minAngles: number[] = [];
  const asymmetries: number[] = [];

  for (const frame of frames) {
    const lShoulder = frame.landmarks[11];
    const lElbow = frame.landmarks[13];
    const lWrist = frame.landmarks[15];

    const rShoulder = frame.landmarks[12];
    const rElbow = frame.landmarks[14];
    const rWrist = frame.landmarks[16];

    if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) continue;

    const leftElbow = calculate3DVectorAngle(toLandmark3D(lShoulder), toLandmark3D(lElbow), toLandmark3D(lWrist));
    const rightElbow = calculate3DVectorAngle(toLandmark3D(rShoulder), toLandmark3D(rElbow), toLandmark3D(rWrist));

    if (!leftElbow.isValid || !rightElbow.isValid) continue;

    const sym = calculateBilateralSymmetry(leftElbow.angleDeg, rightElbow.angleDeg, 15.0);
    asymmetries.push(sym.asymmetryDeg);

    const avgElbowAngle = (leftElbow.angleDeg + rightElbow.angleDeg) / 2.0;
    minAngles.push(avgElbowAngle);

    fsm.processFrame({
      timestampMs: frame.timestampMs,
      leftAngleDeg: leftElbow.angleDeg,
      rightAngleDeg: rightElbow.angleDeg,
      visibilityScore: Math.min(leftElbow.minVisibilityScore, rightElbow.minVisibilityScore),
    });
  }

  const repHistory = fsm.getHistory();
  const fatigue = detectFatigueBreakdown(repHistory);

  const validReps = repHistory.filter((r) => r.isValid).length;
  const invalidReps = repHistory.length - validReps;
  const accuracy = repHistory.length > 0 ? Math.round((validReps / repHistory.length) * 1000) / 10 : 100;

  const avgMinAngleDeg = minAngles.length > 0 ? Math.round((minAngles.reduce((a, b) => a + b, 0) / minAngles.length) * 10) / 10 : 90;
  const avgMaxAsymmetryDeg = asymmetries.length > 0 ? Math.round((asymmetries.reduce((a, b) => a + b, 0) / asymmetries.length) * 10) / 10 : 5;

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const durationSec = firstFrame && lastFrame ? Math.round((lastFrame.timestampMs - firstFrame.timestampMs) / 1000) : 0;


  // Generate specific points to improve
  const pointsToImprove: string[] = [];
  if (invalidReps > 0) {
    const halfReps = repHistory.filter((r) => r.invalidReason === 'HALF_REP_INCOMPLETE_ROM').length;
    const asymReps = repHistory.filter((r) => r.invalidReason === 'ASYMMETRIC_FORM').length;

    if (halfReps > 0) {
      pointsToImprove.push(`Achieve full depth: Lower your chest until elbow flexion is <= 90° (${halfReps} incomplete half-reps detected).`);
    }
    if (asymReps > 0) {
      pointsToImprove.push(`Balance arm drive: Reduce left-to-right arm asymmetry below 15° (${asymReps} asymmetric reps detected).`);
    }
  }

  if (avgMaxAsymmetryDeg > 10.0) {
    pointsToImprove.push(`Focus on symmetrical pushing force to even out your average ${avgMaxAsymmetryDeg}° arm imbalance.`);
  }

  if (fatigue.tempoSlowdownFactor >= 1.35) {
    pointsToImprove.push(`Pacing adjustment: Maintain a steady rep tempo; speed slowed down by ${Math.round((fatigue.tempoSlowdownFactor - 1) * 100)}% towards the end.`);
  }

  if (pointsToImprove.length === 0) {
    pointsToImprove.push('Outstanding execution! Maintain your solid form and depth on your next session.');
  }

  // Calculate improvement from past
  const pastImprovement = calculatePastImprovement({
    validReps,
    formAccuracyPercent: accuracy,
    avgAsymmetryDeg: avgMaxAsymmetryDeg,
  }, pastSession);

  return {
    ok: true,
    exerciseType: 'pushup',
    exerciseName: 'Push-Up Form & Rep Assessment',
    metrics: {
      totalAttempts: repHistory.length,
      validReps,
      invalidReps,
      formAccuracyPercent: accuracy,
      avgMinAngleDeg,
      avgMaxAsymmetryDeg,
      durationSec,
      fatigueDetected: fatigue.fatigueDetected,
      tempoSlowdownFactor: fatigue.tempoSlowdownFactor,
    },
    repHistory,
    fatigueAnalysis: fatigue,
    pointsToImprove,
    pastImprovement,
  };
}

/**
 * Analyzes a frame sequence for Squat performance.
 */
export function analyzeSquats(
  frames: PoseFrame[],
  pastSession?: PastSessionSummary
): ExerciseAnalysisResult {
  const fsm = createExerciseFSM({
    exerciseType: 'squat',
    downAngleThreshold: 95.0,
    upAngleThreshold: 160.0,
    maxAsymmetryDeg: 15.0,
  });

  const minAngles: number[] = [];
  const asymmetries: number[] = [];

  for (const frame of frames) {
    const lHip = frame.landmarks[23];
    const lKnee = frame.landmarks[25];
    const lAnkle = frame.landmarks[27];

    const rHip = frame.landmarks[24];
    const rKnee = frame.landmarks[26];
    const rAnkle = frame.landmarks[28];

    if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) continue;

    const leftKnee = calculate3DVectorAngle(toLandmark3D(lHip), toLandmark3D(lKnee), toLandmark3D(lAnkle));
    const rightKnee = calculate3DVectorAngle(toLandmark3D(rHip), toLandmark3D(rKnee), toLandmark3D(rAnkle));

    if (!leftKnee.isValid || !rightKnee.isValid) continue;

    const sym = calculateBilateralSymmetry(leftKnee.angleDeg, rightKnee.angleDeg, 15.0);
    asymmetries.push(sym.asymmetryDeg);

    const avgKneeAngle = (leftKnee.angleDeg + rightKnee.angleDeg) / 2.0;
    minAngles.push(avgKneeAngle);

    fsm.processFrame({
      timestampMs: frame.timestampMs,
      leftAngleDeg: leftKnee.angleDeg,
      rightAngleDeg: rightKnee.angleDeg,
      visibilityScore: Math.min(leftKnee.minVisibilityScore, rightKnee.minVisibilityScore),
    });
  }

  const repHistory = fsm.getHistory();
  const fatigue = detectFatigueBreakdown(repHistory);

  const validReps = repHistory.filter((r) => r.isValid).length;
  const invalidReps = repHistory.length - validReps;
  const accuracy = repHistory.length > 0 ? Math.round((validReps / repHistory.length) * 1000) / 10 : 100;

  const avgMinAngleDeg = minAngles.length > 0 ? Math.round((minAngles.reduce((a, b) => a + b, 0) / minAngles.length) * 10) / 10 : 90;
  const avgMaxAsymmetryDeg = asymmetries.length > 0 ? Math.round((asymmetries.reduce((a, b) => a + b, 0) / asymmetries.length) * 10) / 10 : 5;

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const durationSec = firstFrame && lastFrame ? Math.round((lastFrame.timestampMs - firstFrame.timestampMs) / 1000) : 0;


  // Generate specific points to improve
  const pointsToImprove: string[] = [];
  if (invalidReps > 0) {
    const halfReps = repHistory.filter((r) => r.invalidReason === 'HALF_REP_INCOMPLETE_ROM').length;
    const asymReps = repHistory.filter((r) => r.invalidReason === 'ASYMMETRIC_FORM').length;

    if (halfReps > 0) {
      pointsToImprove.push(`Squat depth requirement: Lower hips until knees flex <= 95° (${halfReps} shallow reps detected).`);
    }
    if (asymReps > 0) {
      pointsToImprove.push(`Leg weight distribution: Distribute weight evenly across both legs (${asymReps} asymmetric reps detected).`);
    }
  }

  if (avgMaxAsymmetryDeg > 10.0) {
    pointsToImprove.push(`Even out leg loading: Reduce your ${avgMaxAsymmetryDeg}° knee asymmetry.`);
  }

  if (pointsToImprove.length === 0) {
    pointsToImprove.push('Excellent squat form! Parallel depth and bilateral balance achieved.');
  }

  // Calculate improvement from past
  const pastImprovement = calculatePastImprovement({
    validReps,
    formAccuracyPercent: accuracy,
    avgAsymmetryDeg: avgMaxAsymmetryDeg,
  }, pastSession);

  return {
    ok: true,
    exerciseType: 'squat',
    exerciseName: 'Squat Depth & Balance Assessment',
    metrics: {
      totalAttempts: repHistory.length,
      validReps,
      invalidReps,
      formAccuracyPercent: accuracy,
      avgMinAngleDeg,
      avgMaxAsymmetryDeg,
      durationSec,
      fatigueDetected: fatigue.fatigueDetected,
      tempoSlowdownFactor: fatigue.tempoSlowdownFactor,
    },
    repHistory,
    fatigueAnalysis: fatigue,
    pointsToImprove,
    pastImprovement,
  };
}

/**
 * Calculates metrics comparing current assessment against previous session history.
 */
export function calculatePastImprovement(
  current: { validReps: number; formAccuracyPercent: number; avgAsymmetryDeg: number },
  past?: PastSessionSummary
): PastImprovementResult {
  if (!past || past.validReps === undefined) {
    return {
      hasPastData: false,
      summaryText: 'First recorded session for this exercise! Baseline established.',
    };
  }

  const repDelta = current.validReps - past.validReps;
  const pastAccuracy = past.formAccuracyPercent ?? 100;
  const accuracyDeltaPercent = Math.round((current.formAccuracyPercent - pastAccuracy) * 10) / 10;
  const pastAsymmetry = past.avgAsymmetryDeg ?? 5;
  const asymmetryDeltaDeg = Math.round((current.avgAsymmetryDeg - pastAsymmetry) * 10) / 10;

  const parts: string[] = [];
  if (repDelta > 0) parts.push(`+${repDelta} more valid reps`);
  else if (repDelta < 0) parts.push(`${repDelta} valid reps`);
  else parts.push('Same valid rep count');

  if (accuracyDeltaPercent > 0) parts.push(`+${accuracyDeltaPercent}% higher form accuracy`);
  else if (accuracyDeltaPercent < 0) parts.push(`${accuracyDeltaPercent}% form accuracy change`);

  if (asymmetryDeltaDeg < 0) parts.push(`${Math.abs(asymmetryDeltaDeg)}° lower asymmetry (better balance)`);

  return {
    hasPastData: true,
    repDelta,
    accuracyDeltaPercent,
    asymmetryDeltaDeg,
    summaryText: `Progress vs Last Session: ${parts.join(', ')}.`,
  };
}
