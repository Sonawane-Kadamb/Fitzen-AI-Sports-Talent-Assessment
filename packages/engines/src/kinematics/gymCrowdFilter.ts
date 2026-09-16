import type { Landmark3D, Point3D } from './types.js';
import { calculate3DVectorAngle } from './vectorGeometry.js';

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  area: number;
}

export interface TargetAthleteTrackResult {
  isTargetLocked: boolean;
  athletePose: Landmark3D[];
  bbox: BoundingBox2D;
  displacementFromTarget: number;
  crowdNoiseDetected: boolean;
}

export interface SquatKneeAnglesResult {
  leftKneeAngleDeg: number;
  rightKneeAngleDeg: number;
  effectiveKneeAngleDeg: number;
  isOccluded: boolean;
  occludedSide: 'left' | 'right' | 'none';
  asymmetryDeg: number;
  isValid: boolean;
  minVisibilityScore: number;
}

/**
 * Calculates 2D bounding box and center position for a 33-landmark pose.
 */
export function calculatePoseBoundingBox(landmarks: Landmark3D[]): BoundingBox2D {
  if (landmarks.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0, area: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const area = width * height;

  return { minX, minY, maxX, maxY, centerX, centerY, area };
}

/**
 * Applies Exponential Moving Average (EMA) smoothing to pose landmark sequence.
 * Formula: P_smoothed = alpha * P_current + (1 - alpha) * P_prev
 */
export function applyEMALandmarkFilter(
  currentFrame: Landmark3D[],
  previousSmoothedFrame: Landmark3D[] | null,
  alpha: number = 0.35
): Landmark3D[] {
  if (!previousSmoothedFrame || previousSmoothedFrame.length !== currentFrame.length) {
    return currentFrame.map((lm) => ({ ...lm }));
  }

  return currentFrame.map((lm, idx) => {
    const prevLm = previousSmoothedFrame[idx] ?? lm;
    return {
      ...lm,
      x: Math.round((alpha * lm.x + (1 - alpha) * prevLm.x) * 10000) / 10000,
      y: Math.round((alpha * lm.y + (1 - alpha) * prevLm.y) * 10000) / 10000,
      z: Math.round((alpha * lm.z + (1 - alpha) * (prevLm.z ?? lm.z)) * 10000) / 10000,
      visibility: lm.visibility !== undefined ? lm.visibility : prevLm.visibility,
    };
  });
}

/**
 * Tracks the primary athlete in a crowded gym environment.
 * Rejects sudden position jumps from background gym-goers walking past.
 */
export function trackTargetAthletePose(
  currentPose: Landmark3D[],
  lastLockedTargetCenter: Point3D | null,
  maxDisplacementThreshold: number = 0.38
): TargetAthleteTrackResult {
  const bbox = calculatePoseBoundingBox(currentPose);
  const currentCenter: Point3D = { x: bbox.centerX, y: bbox.centerY, z: 0 };

  if (!lastLockedTargetCenter) {
    return {
      isTargetLocked: true,
      athletePose: currentPose,
      bbox,
      displacementFromTarget: 0,
      crowdNoiseDetected: false,
    };
  }

  const dx = currentCenter.x - lastLockedTargetCenter.x;
  const dy = currentCenter.y - lastLockedTargetCenter.y;
  const displacement = Math.sqrt(dx * dx + dy * dy);

  const crowdNoiseDetected = displacement > maxDisplacementThreshold;
  const isTargetLocked = !crowdNoiseDetected;

  return {
    isTargetLocked,
    athletePose: currentPose,
    bbox,
    displacementFromTarget: Math.round(displacement * 1000) / 1000,
    crowdNoiseDetected,
  };
}

/**
 * Computes bilateral squat knee angles with automatic Single-Leg / Occlusion Fallback.
 * If one leg is occluded by gym equipment or another person (visibility < minVis),
 * falls back to the fully visible leg for squat depth tracking.
 */
export function calculateSquatKneeAnglesWithFallback(
  landmarks: Landmark3D[],
  minVisibilityThreshold: number = 0.50
): SquatKneeAnglesResult {
  const lHip = landmarks[23];
  const lKnee = landmarks[25];
  const lAnkle = landmarks[27];

  const rHip = landmarks[24];
  const rKnee = landmarks[26];
  const rAnkle = landmarks[28];

  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) {
    return {
      leftKneeAngleDeg: 180,
      rightKneeAngleDeg: 180,
      effectiveKneeAngleDeg: 180,
      isOccluded: true,
      occludedSide: 'none',
      asymmetryDeg: 0,
      isValid: false,
      minVisibilityScore: 0,
    };
  }

  const leftRes = calculate3DVectorAngle(lHip, lKnee, lAnkle, minVisibilityThreshold);
  const rightRes = calculate3DVectorAngle(rHip, rKnee, rAnkle, minVisibilityThreshold);

  let isOccluded = false;
  let occludedSide: 'left' | 'right' | 'none' = 'none';
  let effectiveKneeAngleDeg = 180;
  let asymmetryDeg = 0;

  if (leftRes.isValid && rightRes.isValid) {
    // Both legs clearly visible
    effectiveKneeAngleDeg = (leftRes.angleDeg + rightRes.angleDeg) / 2.0;
    asymmetryDeg = Math.abs(leftRes.angleDeg - rightRes.angleDeg);
  } else if (leftRes.isValid && !rightRes.isValid) {
    // Right leg occluded — fall back to left leg
    isOccluded = true;
    occludedSide = 'right';
    effectiveKneeAngleDeg = leftRes.angleDeg;
  } else if (!leftRes.isValid && rightRes.isValid) {
    // Left leg occluded — fall back to right leg
    isOccluded = true;
    occludedSide = 'left';
    effectiveKneeAngleDeg = rightRes.angleDeg;
  } else {
    // Both legs obscured
    isOccluded = true;
    occludedSide = 'none';
  }

  const minVisibilityScore = Math.min(leftRes.minVisibilityScore, rightRes.minVisibilityScore);
  const isValid = leftRes.isValid || rightRes.isValid;

  return {
    leftKneeAngleDeg: leftRes.angleDeg,
    rightKneeAngleDeg: rightRes.angleDeg,
    effectiveKneeAngleDeg: Math.round(effectiveKneeAngleDeg * 10) / 10,
    isOccluded,
    occludedSide,
    asymmetryDeg: Math.round(asymmetryDeg * 10) / 10,
    isValid,
    minVisibilityScore,
  };
}
