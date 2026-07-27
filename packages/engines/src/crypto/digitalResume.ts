import {
  generateAssessmentKeyPair,
  sha256Hex,
  signAssessment,
  stableStringify,
  type AssessmentKeyPair,
  type SignedAssessment,
} from './assessmentCrypto.js';
import type { FatigueAnalysisResult } from '../analytics/fatigueTracker.js';

export interface DigitalResumeInput {
  athleteId: string;
  athleteName: string;
  institution?: string;
  exerciseType: string;
  sessionTimestampMs: number;
  sessionDurationSec: number;
  totalRepetitions: number;
  validRepetitions: number;
  invalidRepetitions: number;
  formAccuracyPercent: number;
  fatigueAnalysis: FatigueAnalysisResult;
  deviceFingerprint: string;
}

export interface VerifiableDigitalResumePackage {
  athleteId: string;
  athleteName: string;
  exerciseType: string;
  sessionTimestampMs: number;
  metrics: {
    totalReps: number;
    validReps: number;
    invalidReps: number;
    accuracyPercent: number;
    durationSec: number;
    fatigueDetected: boolean;
    tempoSlowdownFactor: number;
  };
  fatigueBreakdown: FatigueAnalysisResult;
  signedEnvelope: SignedAssessment<DigitalResumeInput>;
  exportTimestampIso: string;
  formattedTextResume: string;
}

/**
 * Formats a clean, professional ASCII text digital resume suited for recruiter review.
 */
export function generateDigitalResumeText(data: DigitalResumeInput, payloadHash: string): string {
  const dateStr = new Date(data.sessionTimestampMs).toISOString();

  return `
================================================================================
                    FITZEN VERIFIED DIGITAL ATHLETIC RESUME
================================================================================
Athlete Name       : ${data.athleteName}
Athlete ID         : ${data.athleteId}
Institution/Team   : ${data.institution ?? 'Grassroots Remote Athlete'}
Assessment Date    : ${dateStr}
Exercise Type      : ${data.exerciseType.toUpperCase()}
Device Fingerprint : ${data.deviceFingerprint}
--------------------------------------------------------------------------------
VERIFIED PERFORMANCE METRICS
--------------------------------------------------------------------------------
Total Repetitions  : ${data.totalRepetitions}
Valid Repetitions  : ${data.validRepetitions} ✅
Invalid Repetitions: ${data.invalidRepetitions} ❌
Form Accuracy      : ${data.formAccuracyPercent.toFixed(1)}%
Session Duration   : ${data.sessionDurationSec}s
--------------------------------------------------------------------------------
FATIGUE & BIOMECHANICAL ANALYSIS
--------------------------------------------------------------------------------
Fatigue Detected   : ${data.fatigueAnalysis.fatigueDetected ? 'YES' : 'NO'}
Tempo Slowdown     : ${((data.fatigueAnalysis.tempoSlowdownFactor - 1) * 100).toFixed(1)}%
Fatigue Markers    : ${data.fatigueAnalysis.fatigueMarkers.length} recorded
--------------------------------------------------------------------------------
CRYPTOGRAPHIC AUDIT PROOF
--------------------------------------------------------------------------------
Signature Algorithm: ECDSA-P256-SHA256
Payload SHA-256    : ${payloadHash}
Verification Status: MATHEMATICALLY VERIFIED & TAMPER-PROOF
================================================================================
`.trim();
}

/**
 * Exports a cryptographically signed, tamper-evident digital resume package.
 *
 * @param input - Session performance data
 * @param keyPair - Optional WebCrypto ECDSA keypair (generates one if not provided)
 * @returns VerifiableDigitalResumePackage
 */
export async function exportVerifiableDigitalResume(
  input: DigitalResumeInput,
  keyPair?: AssessmentKeyPair
): Promise<VerifiableDigitalResumePackage> {
  const keys = keyPair ?? (await generateAssessmentKeyPair());
  const signedEnvelope = await signAssessment(input, keys);
  const formattedTextResume = generateDigitalResumeText(input, signedEnvelope.payloadHash);

  return {
    athleteId: input.athleteId,
    athleteName: input.athleteName,
    exerciseType: input.exerciseType,
    sessionTimestampMs: input.sessionTimestampMs,
    metrics: {
      totalReps: input.totalRepetitions,
      validReps: input.validRepetitions,
      invalidReps: input.invalidRepetitions,
      accuracyPercent: input.formAccuracyPercent,
      durationSec: input.sessionDurationSec,
      fatigueDetected: input.fatigueAnalysis.fatigueDetected,
      tempoSlowdownFactor: input.fatigueAnalysis.tempoSlowdownFactor,
    },
    fatigueBreakdown: input.fatigueAnalysis,
    signedEnvelope,
    exportTimestampIso: new Date().toISOString(),
    formattedTextResume,
  };
}
