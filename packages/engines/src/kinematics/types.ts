/**
* 3D Kinematic Data Structures & Angle Computation Types for Fitzen.
*/

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Landmark3D extends Point3D {
  visibility?: number;
  name?: string;
}

export interface AngleResult {
  /** Joint angle in degrees [0, 180] */
  angleDeg: number;
  /** True if all participating joint landmarks meet the minVisibility threshold */
  isValid: boolean;
  /** Minimum visibility score among participating landmarks */
  minVisibilityScore: number;
}

export interface SymmetryResult {
  /** Absolute difference between left and right limb joint angles in degrees */
  asymmetryDeg: number;
  /** True if asymmetry is within configured maximum threshold */
  isSymmetrical: boolean;
  /** Left limb joint angle in degrees */
  leftAngleDeg: number;
  /** Right limb joint angle in degrees */
  rightAngleDeg: number;
}

export interface SavitzkyGolayOptions {
  /** Size of the sliding window (must be odd, e.g. 5 or 7). Default: 5 */
  windowSize?: number;
}
