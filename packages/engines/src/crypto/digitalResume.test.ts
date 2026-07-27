import { describe, expect, it } from 'vitest';
import { exportVerifiableDigitalResume } from './digitalResume.js';
import { verifyAssessment } from './assessmentCrypto.js';

describe('Module 4: Cryptographic Verifiable Resume Exporter', () => {
  it('generates a signed digital resume package with ECDSA P-256 signature and canonical SHA-256 hash', async () => {
    const resumePkg = await exportVerifiableDigitalResume({
      athleteId: 'ath_kabir_123',
      athleteName: 'Kabir Singh',
      institution: 'Nashik Sports Academy',
      exerciseType: 'pushup',
      sessionTimestampMs: 1700000000000,
      sessionDurationSec: 45,
      totalRepetitions: 10,
      validRepetitions: 9,
      invalidRepetitions: 1,
      formAccuracyPercent: 90.0,
      deviceFingerprint: 'dev_fp_web_98765',
      fatigueAnalysis: {
        totalReps: 10,
        validReps: 9,
        invalidReps: 1,
        formAccuracyPercent: 90.0,
        averageRepDurationMs: 4500,
        tempoSlowdownFactor: 1.1,
        fatigueDetected: false,
        fatigueMarkers: [],
      },
    });

    expect(resumePkg.athleteId).toBe('ath_kabir_123');
    expect(resumePkg.metrics.validReps).toBe(9);
    expect(resumePkg.signedEnvelope.algorithm).toBe('ECDSA-P256-SHA256');
    expect(resumePkg.signedEnvelope.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(resumePkg.signedEnvelope.signature).toBeDefined();

    // Verify signature cryptographically
    const verifyRes = await verifyAssessment(resumePkg.signedEnvelope);
    expect(verifyRes.valid).toBe(true);
    expect(verifyRes.checks.hashMatches).toBe(true);
    expect(verifyRes.checks.signatureValid).toBe(true);

    expect(resumePkg.formattedTextResume).toContain('FITZEN VERIFIED DIGITAL ATHLETIC RESUME');
    expect(resumePkg.formattedTextResume).toContain('Kabir Singh');
  });
});
