import type { AngleResult, Landmark3D, Point3D, SymmetryResult } from './types.js';

/**
 * Calculates 3D biomechanical joint angle theta_ABC at joint B formed by vectors BA and BC.
 * Formula: arccos( (BA . BC) / (||BA|| * ||BC||) )
 *
 * @param pointA - First landmark (e.g. Shoulder for elbow angle)
 * @param pointB - Vertex joint landmark (e.g. Elbow)
 * @param pointC - Third landmark (e.g. Wrist for elbow angle)
 * @param minVisibility - Minimum required visibility score (default 0.5)
 * @returns AngleResult containing angle in degrees [0, 180] and validity flag
 */
export function calculate3DVectorAngle(
  pointA: Landmark3D,
  pointB: Landmark3D,
  pointC: Landmark3D,
  minVisibility: number = 0.5
): AngleResult {
  const visA = pointA.visibility ?? 1.0;
  const visB = pointB.visibility ?? 1.0;
  const visC = pointC.visibility ?? 1.0;
  const minVisibilityScore = Math.min(visA, visB, visC);
  const isValid = minVisibilityScore >= minVisibility;

  // Vector BA = A - B
  const ba: Point3D = {
    x: pointA.x - pointB.x,
    y: pointA.y - pointB.y,
    z: pointA.z - pointB.z,
  };

  // Vector BC = C - B
  const bc: Point3D = {
    x: pointC.x - pointB.x,
    y: pointC.y - pointB.y,
    z: pointC.z - pointB.z,
  };

  // Dot product BA . BC
  const dotProduct = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;

  // Norms (magnitudes)
  const normBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const normBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);

  // Prevent divide-by-zero if two joints coincide
  if (normBA === 0 || normBC === 0) {
    return {
      angleDeg: 0,
      isValid: false,
      minVisibilityScore,
    };
  }

  // Cosine of angle clamped to [-1, 1] to avoid NaN from floating point imprecision
  const cosTheta = Math.max(-1.0, Math.min(1.0, dotProduct / (normBA * normBC)));
  const angleRad = Math.acos(cosTheta);
  const angleDeg = (angleRad * 180.0) / Math.PI;

  return {
    angleDeg: Math.round(angleDeg * 100) / 100, // round to 2 decimal places
    isValid,
    minVisibilityScore,
  };
}

/**
 * Calculates bilateral symmetry between left and right joint angles.
 *
 * @param leftAngle - Left limb angle in degrees
 * @param rightAngle - Right limb angle in degrees
 * @param maxAsymmetryDeg - Maximum allowable asymmetry tolerance (default 15 degrees)
 * @returns SymmetryResult with asymmetry in degrees and Boolean compliance
 */
export function calculateBilateralSymmetry(
  leftAngle: number,
  rightAngle: number,
  maxAsymmetryDeg: number = 15.0
): SymmetryResult {
  const asymmetryDeg = Math.round(Math.abs(leftAngle - rightAngle) * 100) / 100;
  const isSymmetrical = asymmetryDeg <= maxAsymmetryDeg;

  return {
    asymmetryDeg,
    isSymmetrical,
    leftAngleDeg: leftAngle,
    rightAngleDeg: rightAngle,
  };
}
