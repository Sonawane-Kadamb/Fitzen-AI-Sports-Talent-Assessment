import type { AuditEntry, SignedAssessment } from '@fitzen/engines';

export type Role = 'athlete' | 'coach' | 'admin';
export type Sex = 'male' | 'female';
export type Integrity = 'verified' | 'tampered' | 'unverified';

export interface UserRecord {
  id: string;
  email: string;
  role: Role;
  name: string;
  createdAt: string;
}

export interface AthleteProfile {
  userId: string;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  massKg: number;
  midParentalHeightCm?: number;
  sport?: string;
  region?: string;
  coachId?: string;
  updatedAt: string;
}

/**
 * The metric block that is signed and stored. Field names are stable and are
 * exactly what the crypto engine's plausibility checks read.
 */
export interface SignedMetrics {
  jumpHeightM: number;
  jumpHeightCiLow: number;
  jumpHeightCiHigh: number;
  flightTimeS: number;
  peakPowerW: number;
  relativePowerWkg: number;
  symmetryScore: number;
  movementQuality: number;
  confidence: number;
  effectiveFps: number;
  countermovementDepth: number;
  qualityFlags: string[];
  validReps?: number;
  totalAttempts?: number;
  formAccuracyPercent?: number;
  avgAsymmetryDeg?: number;
}


export interface AssessmentPayload {
  clientId: string;
  athleteId: string;
  test: string;
  capturedAt: string;
  metrics: SignedMetrics;
}

/** The full signed envelope the client uploads. */
export interface AssessmentEnvelope {
  signed: SignedAssessment<AssessmentPayload>;
  auditTrail: AuditEntry[];
}

export interface AssessmentRecord {
  id: string;
  clientId: string;
  athleteId: string;
  test: string;
  capturedAt: string;
  createdAt: string;
  metrics: SignedMetrics;
  integrity: Integrity;
  integrityReasons: string[];
  keyFingerprint: string;
}
