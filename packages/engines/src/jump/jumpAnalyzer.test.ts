import { describe, it, expect } from 'vitest';
import { analyzeJump } from './jumpAnalyzer.js';
import { simulateJump } from './simulateJump.js';
import type { AthleteAnthropometrics } from './types.js';

const athlete: AthleteAnthropometrics = { heightCm: 180, massKg: 75 };

describe('analyzeJump', () => {
  it('recovers a known jump height within its 95% confidence interval', () => {
    const trueHeight = 0.45;
    const frames = simulateJump({
      jumpHeightM: trueHeight,
      athleteHeightCm: athlete.heightCm,
      fps: 60,
      seed: 7,
    });
    const result = analyzeJump(frames, athlete);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { jumpHeight, flightTime } = result.metrics;
    // Point estimate is close to ground truth.
    expect(Math.abs(jumpHeight.value - trueHeight)).toBeLessThan(0.06);
    // Ground truth falls within the reported CI.
    expect(trueHeight).toBeGreaterThanOrEqual(jumpHeight.ci95[0]);
    expect(trueHeight).toBeLessThanOrEqual(jumpHeight.ci95[1]);
    // Flight time is physically consistent with the height.
    expect(flightTime.value).toBeGreaterThan(0.2);
    expect(flightTime.value).toBeLessThan(0.7);
  });

  it('produces monotonically higher estimates for higher jumps', () => {
    const low = analyzeJump(
      simulateJump({ jumpHeightM: 0.3, athleteHeightCm: 180, fps: 60, seed: 1 }),
      athlete,
    );
    const high = analyzeJump(
      simulateJump({ jumpHeightM: 0.6, athleteHeightCm: 180, fps: 60, seed: 1 }),
      athlete,
    );
    expect(low.ok && high.ok).toBe(true);
    if (!low.ok || !high.ok) return;
    expect(high.metrics.jumpHeight.value).toBeGreaterThan(low.metrics.jumpHeight.value);
  });

  it('reports wider uncertainty at lower frame rates', () => {
    const hz60 = analyzeJump(
      simulateJump({ jumpHeightM: 0.5, athleteHeightCm: 180, fps: 60, seed: 3 }),
      athlete,
    );
    const hz24 = analyzeJump(
      simulateJump({ jumpHeightM: 0.5, athleteHeightCm: 180, fps: 24, seed: 3 }),
      athlete,
    );
    expect(hz60.ok && hz24.ok).toBe(true);
    if (!hz60.ok || !hz24.ok) return;
    expect(hz24.metrics.flightTime.sigma).toBeGreaterThan(hz60.metrics.flightTime.sigma);
  });

  it('flags high asymmetry with a lower symmetry score', () => {
    const symmetric = analyzeJump(
      simulateJump({ jumpHeightM: 0.4, athleteHeightCm: 180, fps: 60, asymmetry: 0, seed: 9 }),
      athlete,
    );
    const asymmetric = analyzeJump(
      simulateJump({ jumpHeightM: 0.4, athleteHeightCm: 180, fps: 60, asymmetry: 0.9, seed: 9 }),
      athlete,
    );
    expect(symmetric.ok && asymmetric.ok).toBe(true);
    if (!symmetric.ok || !asymmetric.ok) return;
    expect(asymmetric.metrics.symmetryScore).toBeLessThanOrEqual(
      symmetric.metrics.symmetryScore,
    );
  });

  it('computes positive power and relative power', () => {
    const r = analyzeJump(
      simulateJump({ jumpHeightM: 0.55, athleteHeightCm: 185, fps: 60, seed: 11 }),
      { heightCm: 185, massKg: 80 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metrics.peakPowerW).toBeGreaterThan(0);
    expect(r.metrics.relativePowerWkg).toBeGreaterThan(0);
  });

  it('rejects too-short clips', () => {
    const frames = simulateJump({ jumpHeightM: 0.4, athleteHeightCm: 180, fps: 60 }).slice(0, 10);
    const r = analyzeJump(frames, athlete);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('insufficient_frames');
  });

  it('rejects a clip with no takeoff (standing still)', () => {
    const frames = simulateJump({ jumpHeightM: 0.0001, athleteHeightCm: 180, fps: 60 });
    const r = analyzeJump(frames, athlete);
    expect(r.ok).toBe(false);
  });
});
