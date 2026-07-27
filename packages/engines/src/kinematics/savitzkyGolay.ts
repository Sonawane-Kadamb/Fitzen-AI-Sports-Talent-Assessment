import type { Landmark3D, Point3D } from './types.js';

/**
 * 5-point Savitzky-Golay quadratic/cubic convolution coefficients.
 * Normalizing divisor is 35.
 */
const SG_5_COEFFS = [-3, 12, 17, 12, -3];
const SG_5_NORM = 35;

/**
 * Smooths a sequence of 3D points over time using a 5-point Savitzky-Golay filter.
 *
 * @param history - Array of 3D points ordered chronologically [t-4, t-3, t-2, t-1, t]
 * @returns Smoothed Point3D for the target frame (center/latest)
 */
export function smoothPoint3DSavitzkyGolay(history: Point3D[]): Point3D {
  if (history.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  if (history.length < 5) {
    // Return latest if insufficient frames for 5-point kernel
    const last = history[history.length - 1] ?? { x: 0, y: 0, z: 0 };
    return { x: last.x, y: last.y, z: last.z };
  }

  // Use the 5 most recent frames
  const window = history.slice(-5);

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (let i = 0; i < 5; i++) {
    const coeff = SG_5_COEFFS[i] ?? 0;
    const pt = window[i] ?? { x: 0, y: 0, z: 0 };
    sumX += coeff * pt.x;
    sumY += coeff * pt.y;
    sumZ += coeff * pt.z;
  }

  return {
    x: Math.round((sumX / SG_5_NORM) * 10000) / 10000,
    y: Math.round((sumY / SG_5_NORM) * 10000) / 10000,
    z: Math.round((sumZ / SG_5_NORM) * 10000) / 10000,
  };
}

/**
 * Applies Savitzky-Golay temporal smoothing across an entire frame array of 33 body landmarks.
 *
 * @param landmarkHistory - Array of frames, where each frame is an array of 33 Landmark3D objects
 * @returns Smoothed Landmark3D array for the latest frame
 */
export function applySavitzkyGolayFilter(landmarkHistory: Landmark3D[][]): Landmark3D[] {
  if (landmarkHistory.length === 0) return [];
  const latestFrame = landmarkHistory[landmarkHistory.length - 1] ?? [];
  if (landmarkHistory.length < 5) return latestFrame;

  const numLandmarks = latestFrame.length;
  const smoothedFrame: Landmark3D[] = [];

  const recent5Frames = landmarkHistory.slice(-5);

  for (let l = 0; l < numLandmarks; l++) {
    const targetLandmark = latestFrame[l] ?? { x: 0, y: 0, z: 0 };
    const pointHistory: Point3D[] = recent5Frames.map((frame) => {
      const lm = frame[l];
      return lm ? { x: lm.x, y: lm.y, z: lm.z } : { x: 0, y: 0, z: 0 };
    });

    const smoothedPoint = smoothPoint3DSavitzkyGolay(pointHistory);

    smoothedFrame.push({
      ...targetLandmark,
      x: smoothedPoint.x,
      y: smoothedPoint.y,
      z: smoothedPoint.z,
    });
  }

  return smoothedFrame;
}
