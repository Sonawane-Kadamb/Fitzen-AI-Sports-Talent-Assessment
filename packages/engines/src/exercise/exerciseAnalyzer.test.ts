import { describe, expect, it } from 'vitest';
import { analyzePushups, analyzeSquats, calculatePastImprovement } from './exerciseAnalyzer.js';
import { simulatePushupSession, simulateSquatSession } from './simulateExercises.ts';

describe('Exercise Analyzers (Push-Ups & Squats)', () => {
  it('analyzes Push-Up session and produces points to improve', () => {
    const frames = simulatePushupSession({ targetReps: 5, includeFormError: true });
    const analysis = analyzePushups(frames, { validReps: 3, formAccuracyPercent: 75 });

    expect(analysis.ok).toBe(true);
    expect(analysis.exerciseType).toBe('pushup');
    expect(analysis.metrics.totalAttempts).toBeGreaterThan(0);
    expect(analysis.metrics.repAccuracyPercent).toBeDefined();
    expect(analysis.pointsToImprove.length).toBeGreaterThan(0);
    expect(analysis.improvementChecklist.length).toBeGreaterThan(0);
    expect(analysis.pastImprovement.hasPastData).toBe(true);
    expect(analysis.pastImprovement.summaryText).toContain('Progress vs Last Session');
  });

  it('analyzes Squat session and produces points to improve', () => {
    const frames = simulateSquatSession({ targetReps: 5, includeFormError: true });
    const analysis = analyzeSquats(frames, { validReps: 3, formAccuracyPercent: 75 });

    expect(analysis.ok).toBe(true);
    expect(analysis.exerciseType).toBe('squat');
    expect(analysis.metrics.totalAttempts).toBeGreaterThan(0);
    expect(analysis.metrics.repAccuracyPercent).toBeDefined();
    expect(analysis.pointsToImprove.length).toBeGreaterThan(0);
    expect(analysis.improvementChecklist.length).toBeGreaterThan(0);
  });

  it('calculates improvement metrics correctly against past history', () => {
    const improvement = calculatePastImprovement(
      { validReps: 8, formAccuracyPercent: 90.0, avgAsymmetryDeg: 4.2 },
      { validReps: 5, formAccuracyPercent: 80.0, avgAsymmetryDeg: 8.5 }
    );

    expect(improvement.hasPastData).toBe(true);
    expect(improvement.repDelta).toBe(3);
    expect(improvement.accuracyDeltaPercent).toBe(10.0);
    expect(improvement.asymmetryDeltaDeg).toBe(-4.3);
    expect(improvement.summaryText).toContain('+3 more valid reps');
  });
});
