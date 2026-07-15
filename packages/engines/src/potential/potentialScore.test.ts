import { describe, it, expect } from 'vitest';
import { computePotential, type PotentialFeatures } from './potentialScore.js';

const base: PotentialFeatures = {
  ageYears: 14,
  sex: 'male',
  heightCm: 168,
  massKg: 58,
  jumpHeightM: 0.42,
  relativePowerWkg: 42,
  movementQuality: 78,
  symmetryScore: 88,
  jumpCv: 0.05,
  assessmentCount: 6,
};

describe('computePotential', () => {
  it('returns all scores in [0,100]', () => {
    const r = computePotential(base);
    for (const v of [r.currentPerformance, r.potentialScore, r.confidenceScore]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('never reports potential below current performance', () => {
    const r = computePotential(base);
    expect(r.potentialScore).toBeGreaterThanOrEqual(r.currentPerformance);
  });

  it('gives a younger (pre-PHV) athlete more headroom than an older one', () => {
    const young = computePotential({ ...base, ageYears: 12, heightCm: 150, massKg: 42 });
    const old = computePotential({ ...base, ageYears: 24, heightCm: 185, massKg: 82 });
    expect(young.components.maturityHeadroom).toBeGreaterThan(old.components.maturityHeadroom);
  });

  it('raises confidence with more assessments and lower variability', () => {
    const few = computePotential({ ...base, assessmentCount: 1, jumpCv: 0.14 });
    const many = computePotential({ ...base, assessmentCount: 12, jumpCv: 0.02 });
    expect(many.confidenceScore).toBeGreaterThan(few.confidenceScore);
  });

  it('produces explainable insights with signed contributions', () => {
    const r = computePotential(base);
    expect(r.insights.length).toBeGreaterThan(0);
    for (const insight of r.insights) {
      expect(typeof insight.message).toBe('string');
      expect(insight.message.length).toBeGreaterThan(0);
      expect(['strength', 'opportunity', 'context']).toContain(insight.kind);
    }
  });

  it('surfaces low movement quality as an opportunity', () => {
    const r = computePotential({ ...base, movementQuality: 45 });
    const mq = r.insights.find((i) => i.factor === 'Movement quality');
    expect(mq).toBeDefined();
    expect(mq?.kind).toBe('opportunity');
  });

  it('rewards stronger explosiveness with a higher current performance', () => {
    const weak = computePotential({ ...base, jumpHeightM: 0.28, relativePowerWkg: 30 });
    const strong = computePotential({ ...base, jumpHeightM: 0.6, relativePowerWkg: 58 });
    expect(strong.currentPerformance).toBeGreaterThan(weak.currentPerformance);
  });
});
