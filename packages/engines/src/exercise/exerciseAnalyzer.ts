import { calculate3DVectorAngle, calculateBilateralSymmetry } from '../kinematics/vectorGeometry.js';
import { createExerciseFSM } from '../fsm/exerciseFSM.js';
import { detectFatigueBreakdown, type FatigueAnalysisResult } from '../analytics/fatigueTracker.js';
import type { Landmark, PoseFrame } from '../jump/types.js';
import type { Landmark3D } from '../kinematics/types.js';
import type { RepetitionRecord, SetAnalysisResult, SetRecord } from '../fsm/types.js';

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

export interface ImprovementCheckItem {
  id: string;
  category: 'depth' | 'symmetry' | 'tempo' | 'form';
  name: string;
  status: 'pass' | 'warning' | 'action_needed';
  detail: string;
  recommendation: string;
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
    repAccuracyPercent: number;
    avgMinAngleDeg: number;
    avgMaxAsymmetryDeg: number;
    durationSec: number;
    fatigueDetected: boolean;
    tempoSlowdownFactor: number;
  };
  repHistory: RepetitionRecord[];
  setAnalysis: SetAnalysisResult;
  fatigueAnalysis: FatigueAnalysisResult;
  pointsToImprove: string[];
  improvementChecklist: ImprovementCheckItem[];
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
  const accuracy = calculateBiometricAccuracy('pushup', repHistory);

  const avgMinAngleDeg = minAngles.length > 0 ? Math.round((minAngles.reduce((a, b) => a + b, 0) / minAngles.length) * 10) / 10 : 90;
  const avgMaxAsymmetryDeg = asymmetries.length > 0 ? Math.round((asymmetries.reduce((a, b) => a + b, 0) / asymmetries.length) * 10) / 10 : 5;

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const durationSec = firstFrame && lastFrame ? Math.round((lastFrame.timestampMs - firstFrame.timestampMs) / 1000) : 0;


  // Build structured improvement checklist
  const improvementChecklist = buildImprovementChecklist('pushup', repHistory, avgMinAngleDeg, avgMaxAsymmetryDeg, fatigue);

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

  const setAnalysis = analyzeSets(repHistory);

  return {
    ok: true,
    exerciseType: 'pushup',
    exerciseName: 'Push-Up Form & Rep Assessment',
    metrics: {
      totalAttempts: repHistory.length,
      validReps,
      invalidReps,
      formAccuracyPercent: accuracy,
      repAccuracyPercent: accuracy,
      avgMinAngleDeg,
      avgMaxAsymmetryDeg,
      durationSec,
      fatigueDetected: fatigue.fatigueDetected,
      tempoSlowdownFactor: fatigue.tempoSlowdownFactor,
    },
    repHistory,
    setAnalysis,
    fatigueAnalysis: fatigue,
    pointsToImprove,
    improvementChecklist,
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
  const accuracy = calculateBiometricAccuracy('squat', repHistory);

  const avgMinAngleDeg = minAngles.length > 0 ? Math.round((minAngles.reduce((a, b) => a + b, 0) / minAngles.length) * 10) / 10 : 90;
  const avgMaxAsymmetryDeg = asymmetries.length > 0 ? Math.round((asymmetries.reduce((a, b) => a + b, 0) / asymmetries.length) * 10) / 10 : 5;

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const durationSec = firstFrame && lastFrame ? Math.round((lastFrame.timestampMs - firstFrame.timestampMs) / 1000) : 0;

  // Build structured improvement checklist
  const improvementChecklist = buildImprovementChecklist('squat', repHistory, avgMinAngleDeg, avgMaxAsymmetryDeg, fatigue);

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

  const setAnalysis = analyzeSets(repHistory);

  return {
    ok: true,
    exerciseType: 'squat',
    exerciseName: 'Squat Depth & Balance Assessment',
    metrics: {
      totalAttempts: repHistory.length,
      validReps,
      invalidReps,
      formAccuracyPercent: accuracy,
      repAccuracyPercent: accuracy,
      avgMinAngleDeg,
      avgMaxAsymmetryDeg,
      durationSec,
      fatigueDetected: fatigue.fatigueDetected,
      tempoSlowdownFactor: fatigue.tempoSlowdownFactor,
    },
    repHistory,
    setAnalysis,
    fatigueAnalysis: fatigue,
    pointsToImprove,
    improvementChecklist,
    pastImprovement,
  };
}

function buildImprovementChecklist(
  testType: 'pushup' | 'squat',
  repHistory: RepetitionRecord[],
  avgMinAngleDeg: number,
  avgMaxAsymmetryDeg: number,
  fatigue: FatigueAnalysisResult
): ImprovementCheckItem[] {
  const items: ImprovementCheckItem[] = [];
  const validReps = repHistory.filter((r) => r.isValid).length;
  const totalAttempts = repHistory.length;
  const invalidReps = totalAttempts - validReps;
  const halfReps = repHistory.filter((r) => r.invalidReason === 'HALF_REP_INCOMPLETE_ROM').length;
  const asymReps = repHistory.filter((r) => r.invalidReason === 'ASYMMETRIC_FORM').length;

  const depthTarget = testType === 'pushup' ? 90 : 95;
  if (halfReps > 0) {
    items.push({
      id: 'depth-check',
      category: 'depth',
      name: 'Full Range of Motion & Depth',
      status: 'action_needed',
      detail: `${halfReps} incomplete / shallow reps recorded (target <= ${depthTarget}° joint angle).`,
      recommendation: `Lower down fully until your ${testType === 'pushup' ? 'elbow' : 'knee'} angle reaches ${depthTarget}° before ascending.`,
    });
  } else if (avgMinAngleDeg <= depthTarget + 5) {
    items.push({
      id: 'depth-check',
      category: 'depth',
      name: 'Full Range of Motion & Depth',
      status: 'pass',
      detail: `Excellent depth! Achieved average minimum angle of ${avgMinAngleDeg}°.`,
      recommendation: 'Maintain full depth across all repetitions.',
    });
  } else {
    items.push({
      id: 'depth-check',
      category: 'depth',
      name: 'Full Range of Motion & Depth',
      status: 'warning',
      detail: `Average depth was ${avgMinAngleDeg}° (target <= ${depthTarget}°).`,
      recommendation: 'Work on mobility and focus on descending deeper on every rep.',
    });
  }

  if (asymReps > 0 || avgMaxAsymmetryDeg > 12.0) {
    items.push({
      id: 'symmetry-check',
      category: 'symmetry',
      name: 'Bilateral Balance & Alignment',
      status: 'action_needed',
      detail: `Detected ${avgMaxAsymmetryDeg}° average side-to-side asymmetry (${asymReps} imbalanced reps).`,
      recommendation: `Engage both ${testType === 'pushup' ? 'arms' : 'legs'} equally during drive phase to keep asymmetry under 15°.`,
    });
  } else if (avgMaxAsymmetryDeg > 8.0) {
    items.push({
      id: 'symmetry-check',
      category: 'symmetry',
      name: 'Bilateral Balance & Alignment',
      status: 'warning',
      detail: `Moderate asymmetry recorded (${avgMaxAsymmetryDeg}°).`,
      recommendation: 'Focus on uniform bilateral force distribution.',
    });
  } else {
    items.push({
      id: 'symmetry-check',
      category: 'symmetry',
      name: 'Bilateral Balance & Alignment',
      status: 'pass',
      detail: `Great left-right symmetry (${avgMaxAsymmetryDeg}° balance variance).`,
      recommendation: 'Keep maintaining symmetric form during fatigue.',
    });
  }

  if (fatigue.fatigueDetected || fatigue.tempoSlowdownFactor >= 1.35) {
    const slowdownPct = Math.round((fatigue.tempoSlowdownFactor - 1) * 100);
    items.push({
      id: 'tempo-check',
      category: 'tempo',
      name: 'Rep Tempo & Endurance',
      status: 'warning',
      detail: `Pacing slowed down by ${slowdownPct}% towards final reps.`,
      recommendation: 'Focus on controlled eccentric phase and explosive concentric drive.',
    });
  } else {
    items.push({
      id: 'tempo-check',
      category: 'tempo',
      name: 'Rep Tempo & Endurance',
      status: 'pass',
      detail: 'Consistent execution velocity maintained across all completed reps.',
      recommendation: 'Great muscular endurance and cadence control.',
    });
  }

  const accuracyPct = totalAttempts > 0 ? Math.round((validReps / totalAttempts) * 100) : 100;
  if (invalidReps > 0) {
    items.push({
      id: 'rep-accuracy-check',
      category: 'form',
      name: 'Rep Count Accuracy',
      status: accuracyPct >= 80 ? 'warning' : 'action_needed',
      detail: `${validReps} accurate reps out of ${totalAttempts} total attempts (${accuracyPct}% rep accuracy).`,
      recommendation: 'Aim for 100% valid reps by correcting shallow attempts.',
    });
  } else {
    items.push({
      id: 'rep-accuracy-check',
      category: 'form',
      name: 'Rep Count Accuracy',
      status: 'pass',
      detail: `100% rep accuracy! All ${validReps} attempted reps met strict biometric form standards.`,
      recommendation: 'Solid movement quality and rep execution.',
    });
  }

  return items;
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

/**
 * Groups repetition records into sets based on time gaps (> 3.5s) or athlete disappearance.
 */
export function analyzeSets(repHistory: RepetitionRecord[]): SetAnalysisResult {
  if (repHistory.length === 0) {
    return {
      totalSets: 0,
      sets: [],
      summaryText: 'No reps recorded.',
    };
  }

  const setGroups: RepetitionRecord[][] = [];
  let currentGroup: RepetitionRecord[] = [];

  for (let i = 0; i < repHistory.length; i++) {
    const rep = repHistory[i];
    if (!rep) continue;
    if (currentGroup.length > 0) {
      const prevRep = currentGroup[currentGroup.length - 1];
      if (prevRep) {
        const gapMs = rep.timestampMs - prevRep.timestampMs;
        if (gapMs > 3500) {
          setGroups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    currentGroup.push(rep);
  }
  if (currentGroup.length > 0) {
    setGroups.push(currentGroup);
  }

  const sets: SetRecord[] = setGroups.map((group, idx) => {
    const validCount = group.filter((r) => r.isValid).length;
    const repsCount = group.length;
    const accuracyPercent = repsCount > 0 ? Math.round((validCount / repsCount) * 100) : 100;
    const firstRep = group[0];
    const lastRep = group[group.length - 1];
    const firstTimestamp = firstRep ? firstRep.timestampMs : 0;
    const lastTimestamp = lastRep ? lastRep.timestampMs : 0;
    const lastDuration = lastRep ? lastRep.durationMs : 0;
    const durationSec = Math.round(Math.max(1, (lastTimestamp - firstTimestamp + lastDuration) / 1000));
    const avgAsymmetryDeg = repsCount > 0 ? Math.round((group.reduce((acc, r) => acc + r.maxAsymmetryDeg, 0) / repsCount) * 10) / 10 : 0;

    return {
      setIndex: idx + 1,
      repsCount,
      validRepsCount: validCount,
      accuracyPercent,
      durationSec,
      avgAsymmetryDeg,
      repetitionIndices: group.map((r) => r.repIndex),
    };
  });

  const totalSets = sets.length;
  let summaryText = `${totalSets} set${totalSets > 1 ? 's' : ''} completed.`;
  let setVolumeDelta: number | undefined = undefined;
  let accuracyRetentionPercent: number | undefined = undefined;

  const s1 = sets[0];
  const s2 = sets[sets.length - 1];
  if (totalSets >= 2 && s1 && s2) {
    setVolumeDelta = s2.repsCount - s1.repsCount;
    accuracyRetentionPercent = Math.round((s2.accuracyPercent - s1.accuracyPercent) * 10) / 10;

    const deltaStr = setVolumeDelta > 0 ? `+${setVolumeDelta} reps` : `${setVolumeDelta} reps`;
    const accStr = accuracyRetentionPercent >= 0 ? `+${accuracyRetentionPercent}%` : `${accuracyRetentionPercent}%`;
    summaryText = `${totalSets} sets performed! Set volume trend: ${deltaStr}, accuracy retention: ${accStr}.`;
  }

  return {
    totalSets,
    sets,
    setVolumeDelta,
    accuracyRetentionPercent,
    summaryText,
  };
}

/**
 * Calculates continuous biometric form accuracy (%) tending towards valid reps based on joint kinematics.
 */
export function calculateBiometricAccuracy(
  testType: 'pushup' | 'squat',
  repHistory: RepetitionRecord[]
): number {
  if (repHistory.length === 0) return 100.0;

  const targetDepth = testType === 'pushup' ? 90.0 : 95.0;
  const scores: number[] = [];

  for (const r of repHistory) {
    const minAngle = (r.minLeftAngle + r.minRightAngle) / 2.0;
    const depthScore = minAngle <= targetDepth
      ? 100.0
      : Math.max(30.0, 100.0 - (minAngle - targetDepth) * 3.0);

    const symmetryScore = Math.max(40.0, 100.0 - r.maxAsymmetryDeg * 3.5);
    const validityWeight = r.isValid ? 1.0 : 0.65;

    const repScore = (0.55 * depthScore + 0.45 * symmetryScore) * validityWeight;
    scores.push(repScore);
  }

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avgScore * 10) / 10;
}
