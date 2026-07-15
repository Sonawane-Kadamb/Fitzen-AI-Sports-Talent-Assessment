import { describe, it, expect } from 'vitest';
import {
  appendAuditEntry,
  detectTampering,
  generateAssessmentKeyPair,
  signAssessment,
  stableStringify,
  verifyAssessment,
  verifyAuditTrail,
  type AuditEntry,
} from './assessmentCrypto.js';

const samplePayload = {
  assessmentId: 'a-123',
  athleteId: 'ath-1',
  test: 'vertical_jump',
  metrics: {
    jumpHeightM: 0.52,
    flightTimeS: 0.651,
    relativePowerWkg: 52.3,
  },
  capturedAt: '2026-07-06T10:00:00.000Z',
};

describe('stableStringify', () => {
  it('is order-independent for object keys', () => {
    const a = stableStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = stableStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });
  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('sign / verify', () => {
  it('verifies a freshly signed assessment', async () => {
    const keys = await generateAssessmentKeyPair();
    const signed = await signAssessment(samplePayload, keys);
    const v = await verifyAssessment(signed);
    expect(v.valid).toBe(true);
    expect(v.checks.hashMatches).toBe(true);
    expect(v.checks.signatureValid).toBe(true);
  });

  it('detects a modified payload', async () => {
    const keys = await generateAssessmentKeyPair();
    const signed = await signAssessment(samplePayload, keys);
    const tampered = {
      ...signed,
      payload: {
        ...signed.payload,
        metrics: { ...signed.payload.metrics, jumpHeightM: 0.99 },
      },
    };
    const v = await verifyAssessment(tampered);
    expect(v.valid).toBe(false);
    expect(v.checks.hashMatches).toBe(false);
  });

  it('detects a swapped signature from another key', async () => {
    const keysA = await generateAssessmentKeyPair();
    const keysB = await generateAssessmentKeyPair();
    const signedA = await signAssessment(samplePayload, keysA);
    const signedB = await signAssessment(samplePayload, keysB);
    // Keep A's public key but B's signature.
    const forged = { ...signedA, signature: signedB.signature };
    const v = await verifyAssessment(forged);
    expect(v.valid).toBe(false);
    expect(v.checks.signatureValid).toBe(false);
  });
});

describe('audit trail', () => {
  it('builds and verifies a hash chain', async () => {
    let trail: AuditEntry[] = [];
    trail = await appendAuditEntry(trail, 'captured', { frames: 90 }, '2026-07-06T10:00:00.000Z');
    trail = await appendAuditEntry(trail, 'analyzed', { height: 0.52 }, '2026-07-06T10:00:01.000Z');
    trail = await appendAuditEntry(trail, 'signed', { key: 'abc' }, '2026-07-06T10:00:02.000Z');
    const v = await verifyAuditTrail(trail);
    expect(v.valid).toBe(true);
    expect(trail).toHaveLength(3);
  });

  it('detects an altered audit entry', async () => {
    let trail: AuditEntry[] = [];
    trail = await appendAuditEntry(trail, 'captured', { frames: 90 }, '2026-07-06T10:00:00.000Z');
    trail = await appendAuditEntry(trail, 'analyzed', { height: 0.52 }, '2026-07-06T10:00:01.000Z');
    const mutated = trail.map((e, i) =>
      i === 0 ? { ...e, details: { frames: 9999 } } : e,
    );
    const v = await verifyAuditTrail(mutated);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(0);
  });

  it('detects a removed middle entry (chain break)', async () => {
    let trail: AuditEntry[] = [];
    trail = await appendAuditEntry(trail, 'a', {}, '2026-07-06T10:00:00.000Z');
    trail = await appendAuditEntry(trail, 'b', {}, '2026-07-06T10:00:01.000Z');
    trail = await appendAuditEntry(trail, 'c', {}, '2026-07-06T10:00:02.000Z');
    const withHole = [trail[0]!, trail[2]!].map((e, i) => ({ ...e, index: i }));
    const v = await verifyAuditTrail(withHole);
    expect(v.valid).toBe(false);
  });
});

describe('detectTampering', () => {
  it('passes a clean, consistent, signed assessment', async () => {
    const keys = await generateAssessmentKeyPair();
    const signed = await signAssessment(samplePayload, keys);
    let trail: AuditEntry[] = [];
    trail = await appendAuditEntry(trail, 'captured', {}, '2026-07-06T10:00:00.000Z');
    const report = await detectTampering(signed, trail);
    expect(report.tampered).toBe(false);
    expect(report.reasons).toHaveLength(0);
  });

  it('flags a physically impossible but validly-signed result', async () => {
    const keys = await generateAssessmentKeyPair();
    const impossible = {
      ...samplePayload,
      metrics: { jumpHeightM: 2.5, flightTimeS: 0.651, relativePowerWkg: 52.3 },
    };
    const signed = await signAssessment(impossible, keys);
    const report = await detectTampering(signed);
    // Signature is valid, but plausibility screen catches it.
    expect(report.verification.valid).toBe(true);
    expect(report.tampered).toBe(true);
    expect(report.reasons.join(' ')).toMatch(/plausible/i);
  });

  it('flags flight-time/height inconsistency', async () => {
    const keys = await generateAssessmentKeyPair();
    const inconsistent = {
      ...samplePayload,
      metrics: { jumpHeightM: 0.52, flightTimeS: 0.30, relativePowerWkg: 52.3 },
    };
    const signed = await signAssessment(inconsistent, keys);
    const report = await detectTampering(signed);
    expect(report.tampered).toBe(true);
    expect(report.reasons.join(' ')).toMatch(/inconsistent/i);
  });
});
