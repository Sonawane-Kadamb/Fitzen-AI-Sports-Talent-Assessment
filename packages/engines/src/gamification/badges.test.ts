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

  it('computes newly earned badges across a delta', () => {
    const before = { ...empty, assessmentCount: 9 };
    const after = { ...empty, assessmentCount: 10, bestJumpHeightM: 0.5 };
    const earned = newlyEarnedBadges(before, after);
    expect(earned).toContain('ten-assessments');
    expect(earned).toContain('half-meter-club');
    expect(earned).not.toContain('first-jump'); // already had it before
  });
});
