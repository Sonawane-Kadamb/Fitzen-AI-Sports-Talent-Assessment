import { describe, it, expect } from 'vitest';
import { evaluateBadges, newlyEarnedBadges, type AthleteStats } from './badges.js';

const empty: AthleteStats = {
  assessmentCount: 0,
  bestJumpHeightM: 0,
  bestRelativePowerWkg: 0,
  bestSymmetryScore: 0,
  bestMovementQuality: 0,
  activeDays: 0,
  streakDays: 0,
  bestImprovementM: 0,
};

describe('evaluateBadges', () => {
  it('earns nothing for an empty athlete', () => {
    expect(evaluateBadges(empty).filter((b) => b.earned)).toHaveLength(0);
  });

  it('earns First Flight after one assessment', () => {
    const badges = evaluateBadges({ ...empty, assessmentCount: 1 });
    expect(badges.find((b) => b.id === 'first-jump')?.earned).toBe(true);
  });

  it('reports partial progress toward multi-step badges', () => {
    const badges = evaluateBadges({ ...empty, assessmentCount: 5 });
    const dedicated = badges.find((b) => b.id === 'ten-assessments');
    expect(dedicated?.earned).toBe(false);
    expect(dedicated?.progress).toBeCloseTo(0.5, 5);
  });

  it('earns the Half-Metre Club at 50 cm', () => {
    expect(
      evaluateBadges({ ...empty, bestJumpHeightM: 0.5 }).find((b) => b.id === 'half-meter-club')
        ?.earned,
    ).toBe(true);
  });

  it('earns Push-Up Rookie and Push-Up Titan badges', () => {
    const rookie = evaluateBadges({ ...empty, bestPushups: 5 });
    expect(rookie.find((b) => b.id === 'pushup-rookie')?.earned).toBe(true);

    const titan = evaluateBadges({ ...empty, bestPushups: 20 });
    expect(titan.find((b) => b.id === 'pushup-titan')?.earned).toBe(true);
  });

  it('earns Squat Pioneer and Iron Legs badges', () => {
    const pioneer = evaluateBadges({ ...empty, bestSquats: 10 });
    expect(pioneer.find((b) => b.id === 'squat-pioneer')?.earned).toBe(true);

    const iron = evaluateBadges({ ...empty, bestSquats: 25 });
    expect(iron.find((b) => b.id === 'iron-legs')?.earned).toBe(true);
  });

  it('earns Triple Threat badge when all 3 disciplines are completed', () => {
    const triple = evaluateBadges({ ...empty, completedTestTypes: 3 });
    expect(triple.find((b) => b.id === 'triple-threat')?.earned).toBe(true);
  });

  it('computes newly earned badges across a delta', () => {
    const before = { ...empty, assessmentCount: 9 };
    const after = { ...empty, assessmentCount: 10, bestJumpHeightM: 0.5 };
    const earned = newlyEarnedBadges(before, after);
    expect(earned).toContain('ten-assessments');
    expect(earned).toContain('half-meter-club');
    expect(earned).not.toContain('first-jump'); // already had it before
  });
});
