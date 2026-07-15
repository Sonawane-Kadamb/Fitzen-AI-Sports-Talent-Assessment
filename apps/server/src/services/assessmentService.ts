import {
  detectTampering,
  type AuditEntry,
  type SignedAssessment,
} from '@fitzen/engines';
import type { Database } from '../db.ts';
import { HttpError } from '../http/router.ts';
import { newId } from '../util/id.ts';
import type {
  AssessmentEnvelope,
  AssessmentPayload,
  AssessmentRecord,
  Integrity,
  SignedMetrics,
} from '../domain/types.ts';

/**
 * Server-side assessment ingestion.
 *
 * The authoritative integrity decision happens HERE, not on the client: the
 * server re-verifies the ECDSA signature, re-hashes the canonical payload,
 * validates the audit chain, and screens the metrics for physical
 * plausibility. Clients cannot mark their own results "verified".
 */

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

function coerceMetrics(m: unknown): SignedMetrics {
  if (typeof m !== 'object' || m === null) {
    throw new HttpError(400, 'metrics missing from signed payload');
  }
  const o = m as Record<string, unknown>;
  const required = [
    'jumpHeightM', 'jumpHeightCiLow', 'jumpHeightCiHigh', 'flightTimeS',
    'peakPowerW', 'relativePowerWkg', 'symmetryScore', 'movementQuality',
    'confidence', 'effectiveFps', 'countermovementDepth',
  ];
  for (const k of required) {
    if (Number.isNaN(num(o[k]))) throw new HttpError(400, `metrics.${k} must be a finite number`);
  }
  return {
    jumpHeightM: num(o.jumpHeightM),
    jumpHeightCiLow: num(o.jumpHeightCiLow),
    jumpHeightCiHigh: num(o.jumpHeightCiHigh),
    flightTimeS: num(o.flightTimeS),
    peakPowerW: num(o.peakPowerW),
    relativePowerWkg: num(o.relativePowerWkg),
    symmetryScore: num(o.symmetryScore),
    movementQuality: num(o.movementQuality),
    confidence: num(o.confidence),
    effectiveFps: num(o.effectiveFps),
    countermovementDepth: num(o.countermovementDepth),
    qualityFlags: Array.isArray(o.qualityFlags)
      ? o.qualityFlags.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

export function parseEnvelope(body: unknown, athleteId: string): AssessmentEnvelope {
  if (typeof body !== 'object' || body === null) {
    throw new HttpError(400, 'Expected an assessment envelope');
  }
  const o = body as Record<string, unknown>;
  const signed = o.signed as SignedAssessment<AssessmentPayload> | undefined;
  if (!signed || typeof signed !== 'object' || typeof signed.payload !== 'object') {
    throw new HttpError(400, 'Envelope is missing the signed payload');
  }
  if (typeof signed.signature !== 'string' || typeof signed.payloadHash !== 'string') {
    throw new HttpError(400, 'Signed payload is missing signature or hash');
  }
  const payload = signed.payload;
  if (typeof payload.clientId !== 'string' || payload.clientId.length < 8) {
    throw new HttpError(400, 'payload.clientId is required');
  }
  if (payload.athleteId !== athleteId) {
    throw new HttpError(403, 'Assessment athleteId does not match the authenticated athlete');
  }
  coerceMetrics(payload.metrics);
  const auditTrail = Array.isArray(o.auditTrail) ? (o.auditTrail as AuditEntry[]) : [];
  return { signed, auditTrail };
}

export async function evaluateIntegrity(
  envelope: AssessmentEnvelope,
): Promise<{ integrity: Integrity; reasons: string[] }> {
  const report = await detectTampering(
    envelope.signed as unknown as SignedAssessment<Record<string, unknown>>,
    envelope.auditTrail,
  );
  if (report.tampered) {
    return { integrity: 'tampered', reasons: report.reasons };
  }
  return { integrity: 'verified', reasons: [] };
}

interface UpsertResult {
  record: AssessmentRecord;
  created: boolean;
}

/**
 * Idempotently persist an assessment keyed by (athleteId, clientId).
 * Re-uploading the same client id (e.g. a retried offline sync) returns the
 * existing row instead of duplicating.
 */
export async function ingestAssessment(
  db: Database,
  athleteId: string,
  body: unknown,
): Promise<UpsertResult> {
  const envelope = parseEnvelope(body, athleteId);
  const payload = envelope.signed.payload;

  const existing = db
    .prepare('SELECT id FROM assessments WHERE athlete_id = ? AND client_id = ?')
    .get(athleteId, payload.clientId) as { id: string } | undefined;
  if (existing) {
    return { record: getAssessment(db, existing.id)!, created: false };
  }

  const { integrity, reasons } = await evaluateIntegrity(envelope);
  const metrics = payload.metrics;
  const id = newId('asm');
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO assessments (
      id, client_id, athlete_id, test, captured_at, created_at,
      jump_height_m, jump_height_ci_low, jump_height_ci_high, flight_time_s,
      peak_power_w, relative_power_wkg, symmetry_score, movement_quality, confidence,
      metrics_json, envelope_json, integrity, integrity_reasons_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    payload.clientId,
    athleteId,
    payload.test,
    payload.capturedAt,
    createdAt,
    metrics.jumpHeightM,
    metrics.jumpHeightCiLow,
    metrics.jumpHeightCiHigh,
    metrics.flightTimeS,
    metrics.peakPowerW,
    metrics.relativePowerWkg,
    metrics.symmetryScore,
    metrics.movementQuality,
    metrics.confidence,
    JSON.stringify(metrics),
    JSON.stringify(envelope),
    integrity,
    JSON.stringify(reasons),
  );

  return { record: getAssessment(db, id)!, created: true };
}

function rowToRecord(row: Record<string, unknown>): AssessmentRecord {
  const envelope = JSON.parse(String(row.envelope_json)) as AssessmentEnvelope;
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    athleteId: String(row.athlete_id),
    test: String(row.test),
    capturedAt: String(row.captured_at),
    createdAt: String(row.created_at),
    metrics: JSON.parse(String(row.metrics_json)) as SignedMetrics,
    integrity: String(row.integrity) as Integrity,
    integrityReasons: JSON.parse(String(row.integrity_reasons_json)) as string[],
    keyFingerprint: envelope.signed.keyFingerprint ?? 'unknown',
  };
}

export function getAssessment(db: Database, id: string): AssessmentRecord | null {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToRecord(row) : null;
}

export function listAssessments(db: Database, athleteId: string, limit = 100): AssessmentRecord[] {
  const rows = db
    .prepare('SELECT * FROM assessments WHERE athlete_id = ? ORDER BY captured_at DESC LIMIT ?')
    .all(athleteId, limit) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

/** Re-verify a stored assessment on demand (audit / dispute workflow). */
export async function reverifyAssessment(
  db: Database,
  id: string,
): Promise<{ integrity: Integrity; reasons: string[]; auditValid: boolean } | null> {
  const row = db.prepare('SELECT envelope_json FROM assessments WHERE id = ?').get(id) as
    | { envelope_json: string }
    | undefined;
  if (!row) return null;
  const envelope = JSON.parse(row.envelope_json) as AssessmentEnvelope;
  const report = await detectTampering(
    envelope.signed as unknown as SignedAssessment<Record<string, unknown>>,
    envelope.auditTrail,
  );
  const integrity: Integrity = report.tampered ? 'tampered' : 'verified';
  db.prepare('UPDATE assessments SET integrity = ?, integrity_reasons_json = ? WHERE id = ?').run(
    integrity,
    JSON.stringify(report.reasons),
    id,
  );
  return {
    integrity,
    reasons: report.reasons,
    auditValid: report.audit?.valid ?? true,
  };
}
