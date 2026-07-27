import { describe, expect, it } from 'vitest';
import {
  applySavitzkyGolayFilter,
  calculate3DVectorAngle,
  calculateBilateralSymmetry,
  smoothPoint3DSavitzkyGolay,
  type Landmark3D,
  type Point3D,
} from '../index.js';

describe('Module 1: 3D Vector Geometry & Kinematics Engine', () => {
  describe('calculate3DVectorAngle', () => {
    it('calculates exact 90 degree right angle in 3D spatial coordinates', () => {
      // B at origin (0,0,0)
      // A along positive Y axis (0, 1, 0) - e.g. Shoulder
      // C along positive X axis (1, 0, 0) - e.g. Wrist
      const pointA: Landmark3D = { x: 0, y: 1, z: 0, visibility: 0.9 };
      const pointB: Landmark3D = { x: 0, y: 0, z: 0, visibility: 0.95 };
      const pointC: Landmark3D = { x: 1, y: 0, z: 0, visibility: 0.9 };

      const result = calculate3DVectorAngle(pointA, pointB, pointC);

      expect(result.angleDeg).toBe(90);
      expect(result.isValid).toBe(true);
      expect(result.minVisibilityScore).toBe(0.9);
    });

    it('calculates 180 degree straight line angle', () => {
      // B at (0,0,0)
      // A at (-1, 0, 0)
      // C at (1, 0, 0)
      const pointA: Landmark3D = { x: -1, y: 0, z: 0, visibility: 0.9 };
      const pointB: Landmark3D = { x: 0, y: 0, z: 0, visibility: 0.9 };
      const pointC: Landmark3D = { x: 1, y: 0, z: 0, visibility: 0.9 };

      const result = calculate3DVectorAngle(pointA, pointB, pointC);

      expect(result.angleDeg).toBe(180);
      expect(result.isValid).toBe(true);
    });

    it('flags angle as invalid if any landmark visibility is below minVisibility threshold (0.5)', () => {
      const pointA: Landmark3D = { x: 0, y: 1, z: 0, visibility: 0.9 };
      const pointB: Landmark3D = { x: 0, y: 0, z: 0, visibility: 0.3 }; // Low visibility!
      const pointC: Landmark3D = { x: 1, y: 0, z: 0, visibility: 0.9 };

      const result = calculate3DVectorAngle(pointA, pointB, pointC, 0.5);

      expect(result.angleDeg).toBe(90);
      expect(result.isValid).toBe(false);
      expect(result.minVisibilityScore).toBe(0.3);
    });
  });

  describe('calculateBilateralSymmetry', () => {
    it('passes symmetry check when asymmetry is within tolerance (e.g. 8 deg <= 15 deg)', () => {
      const leftAngle = 88.5;
      const rightAngle = 96.5;

      const result = calculateBilateralSymmetry(leftAngle, rightAngle, 15.0);

      expect(result.asymmetryDeg).toBe(8);
      expect(result.isSymmetrical).toBe(true);
    });

    it('flags asymmetry when angle difference exceeds maximum tolerance (e.g. 20 deg > 15 deg)', () => {
      const leftAngle = 75.0;
      const rightAngle = 95.0;

      const result = calculateBilateralSymmetry(leftAngle, rightAngle, 15.0);

      expect(result.asymmetryDeg).toBe(20);
      expect(result.isSymmetrical).toBe(false);
    });
  });

  describe('Savitzky-Golay Temporal Filter', () => {
    it('attenuates high-frequency noise spike across 5 frames', () => {
      // True signal is constant x = 10.0, frame 3 has a jitter spike of 17.0
      const history: Point3D[] = [
        { x: 10.0, y: 5.0, z: 0.0 },
        { x: 10.0, y: 5.0, z: 0.0 },
        { x: 17.0, y: 5.0, z: 0.0 }, // Jitter spike at center frame!
        { x: 10.0, y: 5.0, z: 0.0 },
        { x: 10.0, y: 5.0, z: 0.0 },
      ];

      const smoothed = smoothPoint3DSavitzkyGolay(history);

      // SG 5-point formula for center frame: (-3*10 + 12*10 + 17*17 + 12*10 + -3*10) / 35 = 469 / 35 = 13.4
      expect(smoothed.x).toBeLessThan(17.0);
      expect(smoothed.x).toBe(13.4);
      expect(smoothed.y).toBe(5.0);

    });

    it('smooths 3D landmarks array across frames', () => {
      const frameTemplate: Landmark3D[] = [
        { x: 1.0, y: 2.0, z: 3.0, visibility: 0.95 },
        { x: 4.0, y: 5.0, z: 6.0, visibility: 0.90 },
      ];

      const landmarkHistory: Landmark3D[][] = Array(5).fill(frameTemplate);

      const smoothedFrame = applySavitzkyGolayFilter(landmarkHistory);

      expect(smoothedFrame).toHaveLength(2);
      expect(smoothedFrame[0].x).toBe(1.0);
      expect(smoothedFrame[0].y).toBe(2.0);
      expect(smoothedFrame[0].z).toBe(3.0);
      expect(smoothedFrame[0].visibility).toBe(0.95);
    });
  });
});
