import { describe, expect, it } from 'vitest';
import { createExerciseFSM } from '../index.js';

describe('Module 2: FSM Fraud Detection & Repetition Engine', () => {
  it('validates a complete, high-quality push-up repetition', () => {
    const fsm = createExerciseFSM({
      exerciseType: 'pushup',
      downAngleThreshold: 90,
      upAngleThreshold: 160,
      maxAsymmetryDeg: 15,
    });

    // 1. Initial position (170 deg - fully extended)
    let res = fsm.processFrame({ timestampMs: 0, leftAngleDeg: 170, rightAngleDeg: 170 });
    expect(res.state).toBe('UP');

    // 2. Descending into DOWN state (85 deg)
    res = fsm.processFrame({ timestampMs: 500, leftAngleDeg: 85, rightAngleDeg: 85 });
    expect(res.state).toBe('DOWN');

    // 3. Pushing back UP to 165 deg
    res = fsm.processFrame({ timestampMs: 1200, leftAngleDeg: 165, rightAngleDeg: 165 });
    expect(res.validReps).toBe(1);
    expect(res.invalidReps).toBe(0);
    expect(res.repCompleted).toBe(true);
    expect(res.lastRepRecord?.isValid).toBe(true);
    expect(res.formAccuracyPercent).toBe(100);
  });

  it('rejects incomplete repetition ("half-rep") that fails down angle threshold', () => {
    const fsm = createExerciseFSM({
      downAngleThreshold: 90,
      upAngleThreshold: 160,
    });

    // 1. Starting UP state
    fsm.processFrame({ timestampMs: 0, leftAngleDeg: 170, rightAngleDeg: 170 });

    // 2. Descends to only 120 deg (does NOT hit <= 90 deg down threshold!)
    fsm.processFrame({ timestampMs: 500, leftAngleDeg: 120, rightAngleDeg: 120 });

    // 3. Reverses back UP to 165 deg
    const res = fsm.processFrame({ timestampMs: 1000, leftAngleDeg: 165, rightAngleDeg: 165 });

    expect(res.validReps).toBe(0);
    expect(res.invalidReps).toBe(1);
    expect(res.lastRepRecord?.isValid).toBe(false);
    expect(res.lastRepRecord?.invalidReason).toBe('HALF_REP_INCOMPLETE_ROM');
  });

  it('rejects repetition executed with asymmetric form (30 deg asymmetry > 15 deg max)', () => {
    const fsm = createExerciseFSM({
      downAngleThreshold: 90,
      upAngleThreshold: 160,
      maxAsymmetryDeg: 15,
    });

    // Starting UP
    fsm.processFrame({ timestampMs: 0, leftAngleDeg: 170, rightAngleDeg: 170 });

    // Asymmetrical descent reaching DOWN state: left=60 deg, right=88 deg (28 deg asymmetry > 15 deg max!)
    fsm.processFrame({ timestampMs: 500, leftAngleDeg: 60, rightAngleDeg: 88 });


    // Returning UP
    const res = fsm.processFrame({ timestampMs: 1100, leftAngleDeg: 165, rightAngleDeg: 165 });

    expect(res.validReps).toBe(0);
    expect(res.invalidReps).toBe(1);
    expect(res.lastRepRecord?.isValid).toBe(false);
    expect(res.lastRepRecord?.invalidReason).toBe('ASYMMETRIC_FORM');
  });
});
