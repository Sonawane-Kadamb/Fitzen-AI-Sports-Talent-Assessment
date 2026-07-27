import { describe, expect, it } from 'vitest';
import { detectFatigueBreakdown } from './fatigueTracker.js';
import type { RepetitionRecord } from '../fsm/types.js';

describe('Module 3: Fatigue Analytics Engine', () => {
  it('analyzes clean session with zero fatigue breakdown', () => {
    const history: RepetitionRecord[] = [
      { repIndex: 1, timestampMs: 1000, durationMs: 1200, isValid: true, minLeftAngle: 85, minRightAngle: 86, maxAsymmetryDeg: 1.0 },
      { repIndex: 2, timestampMs: 2400, durationMs: 1250, isValid: true, minLeftAngle: 84, minRightAngle: 85, maxAsymmetryDeg: 1.0 },
      { repIndex: 3, timestampMs: 3800, durationMs: 1220, isValid: true, minLeftAngle: 85, minRightAngle: 84, maxAsymmetryDeg: 1.0 },
    ];

    const result = detectFatigueBreakdown(history);

    expect(result.totalReps).toBe(3);
    expect(result.validReps).toBe(3);
    expect(result.formAccuracyPercent).toBe(100);
    expect(result.fatigueDetected).toBe(false);
    expect(result.fatigueMarkers).toHaveLength(0);
  });

  it('detects fatigue onset timestamp when form degrades in late repetitions', () => {
    const history: RepetitionRecord[] = [
      { repIndex: 1, timestampMs: 1000, durationMs: 1000, isValid: true, minLeftAngle: 85, minRightAngle: 85, maxAsymmetryDeg: 2.0 },
      { repIndex: 2, timestampMs: 2200, durationMs: 1000, isValid: true, minLeftAngle: 85, minRightAngle: 85, maxAsymmetryDeg: 3.0 },
      { repIndex: 3, timestampMs: 3600, durationMs: 1100, isValid: true, minLeftAngle: 85, minRightAngle: 85, maxAsymmetryDeg: 2.0 },
      // Fatigue onset at rep 4 (high asymmetry & invalid form)
      { repIndex: 4, timestampMs: 5200, durationMs: 1500, isValid: false, minLeftAngle: 80, minRightAngle: 110, maxAsymmetryDeg: 30.0, invalidReason: 'ASYMMETRIC_FORM' },
      { repIndex: 5, timestampMs: 7000, durationMs: 1800, isValid: false, minLeftAngle: 120, minRightAngle: 120, maxAsymmetryDeg: 5.0, invalidReason: 'HALF_REP_INCOMPLETE_ROM' },
    ];

    const result = detectFatigueBreakdown(history);

    expect(result.fatigueDetected).toBe(true);
    expect(result.fatigueOnsetRepIndex).toBe(4);
    expect(result.fatigueOnsetTimestampMs).toBe(5200);
    expect(result.formAccuracyPercent).toBe(60);
    expect(result.tempoSlowdownFactor).toBeGreaterThan(1.35);
  });
});
