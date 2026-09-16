import { describe, expect, it } from 'vitest';
import {
  applyEMALandmarkFilter,
  calculatePoseBoundingBox,
  calculateSquatKneeAnglesWithFallback,
  trackTargetAthletePose,
} from './gymCrowdFilter.js';
import type { Landmark3D } from './types.js';

describe('Gym & Crowded Environment Filter Engine', () => {
  const createMockPose = (offset = 0, kneeVisibility = 1.0): Landmark3D[] => {
    const lms: Landmark3D[] = new Array(33).fill(null).map(() => ({ x: 0.5 + offset, y: 0.5, z: 0, visibility: 0.9 }));
    // Hips
    lms[23] = { x: 0.4 + offset, y: 0.4, z: 0, visibility: 0.95 };
    lms[24] = { x: 0.6 + offset, y: 0.4, z: 0, visibility: 0.95 };
    // Knees
    lms[25] = { x: 0.4 + offset, y: 0.6, z: 0, visibility: kneeVisibility };
    lms[26] = { x: 0.6 + offset, y: 0.6, z: 0, visibility: kneeVisibility };
    // Ankles
    lms[27] = { x: 0.4 + offset, y: 0.8, z: 0, visibility: 0.95 };
    lms[28] = { x: 0.6 + offset, y: 0.8, z: 0, visibility: 0.95 };
    return lms;
  };

  it('calculates bounding box and center accurately', () => {
    const pose = createMockPose();
    const bbox = calculatePoseBoundingBox(pose);
    expect(bbox.centerX).toBeGreaterThan(0);
    expect(bbox.centerY).toBeGreaterThan(0);
    expect(bbox.area).toBeGreaterThan(0);
  });

  it('smooths keypoints with EMA filtering', () => {
    const p1 = createMockPose(0);
    const p2 = createMockPose(0.1);
    const smoothed = applyEMALandmarkFilter(p2, p1, 0.35);

    expect(smoothed[23]!.x).toBeLessThan(p2[23]!.x);
    expect(smoothed[23]!.x).toBeGreaterThan(p1[23]!.x);
  });

  it('detects displacement jumps from background crowd noise', () => {
    const targetCenter = { x: 0.5, y: 0.5, z: 0 };
    const closePose = createMockPose(0.05);
    const farPose = createMockPose(0.5); // Large displacement jump

    const resClose = trackTargetAthletePose(closePose, targetCenter, 0.35);
    expect(resClose.isTargetLocked).toBe(true);
    expect(resClose.crowdNoiseDetected).toBe(false);

    const resFar = trackTargetAthletePose(farPose, targetCenter, 0.35);
    expect(resFar.isTargetLocked).toBe(false);
    expect(resFar.crowdNoiseDetected).toBe(true);
  });

  it('handles single-leg occlusion fallback when one leg is obscured', () => {
    const fullPose = createMockPose(0, 0.95);
    const fullRes = calculateSquatKneeAnglesWithFallback(fullPose);
    expect(fullRes.isOccluded).toBe(false);
    expect(fullRes.isValid).toBe(true);

    // Obscure left knee (visibility = 0.2)
    const occludedPose = createMockPose(0, 0.95);
    occludedPose[25] = { x: 0.4, y: 0.6, z: 0, visibility: 0.2 };

    const occludedRes = calculateSquatKneeAnglesWithFallback(occludedPose, 0.50);
    expect(occludedRes.isOccluded).toBe(true);
    expect(occludedRes.occludedSide).toBe('left');
    expect(occludedRes.isValid).toBe(true); // Still valid because right leg is clear!
  });
});
