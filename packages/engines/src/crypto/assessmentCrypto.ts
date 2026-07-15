/**
 * Cryptographic Assessment Engine.
 *
 * Every assessment produced by Fitzen is:
 *   1. canonicalized (stable JSON) and hashed with SHA-256,
 *   2. digitally signed with the device's ECDSA P-256 key,
 *   3. appended to a hash-chained audit trail.
 *
 * Verification recomputes the hash, checks the signature against the
 * device public key, validates the audit chain link-by-link, and applies
 * physical-plausibility bounds so that even a re-signed but fabricated
 * result is flagged.
 *
 * Uses WebCrypto (`globalThis.crypto.subtle`) — identical code path in the
 * browser and in Node ≥ 18, so client and server verify byte-for-byte the
 * same material.
 */

const subtle = globalThis.crypto.subtle;

export const SIGNING_ALGORITHM = 'ECDSA-P256-SHA256' as const;

const EC_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };

// ---------------------------------------------------------------------------
// Canonical JSON
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON serialization: object keys sorted lexicographically at
 * every depth, no whitespace. Arrays keep their order. undefined values are
 * dropped (matching JSON.stringify semantics).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v === undefined ? null : v)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Encode a string to bytes typed as `BufferSource`. WebCrypto's lib.dom
 * typings require an ArrayBuffer-backed view; `TextEncoder` may return one
 * backed by `ArrayBufferLike`, so we widen through `BufferSource`.
 */
function encodeUtf8(input: string): BufferSource {
  return encoder.encode(input) as BufferSource;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in browsers and Node ≥ 16.
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await subtle.digest('SHA-256', encodeUtf8(input));
  return bytesToHex(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export interface AssessmentKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

/** Generate a device signing keypair (extractable so it can be persisted). */
export async function generateAssessmentKeyPair(): Promise<AssessmentKeyPair> {
  const pair = await subtle.generateKey(EC_PARAMS, true, ['sign', 'verify']);
  return {
    publicKeyJwk: await subtle.exportKey('jwk', pair.publicKey),
    privateKeyJwk: await subtle.exportKey('jwk', pair.privateKey),
  };
}

export function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle.importKey('jwk', jwk, EC_PARAMS, false, ['sign']);
}

export function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle.importKey('jwk', jwk, EC_PARAMS, false, ['verify']);
}

/** Stable fingerprint of a public key (SHA-256 of its canonical JWK). */
export async function publicKeyFingerprint(jwk: JsonWebKey): Promise<string> {
  const canonical = stableStringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return (await sha256Hex(canonical)).slice(0, 16);
}

// ---------------------------------------------------------------------------
// Signing & verification
// ---------------------------------------------------------------------------

export interface SignedAssessment<P = Record<string, unknown>> {
  /** The assessment payload that was signed (canonicalized before hashing). */
  payload: P;
  /** SHA-256 hex digest of the canonical payload. */
  payloadHash: string;
  /** Base64 ECDSA signature over the canonical payload bytes. */
  signature: string;
  /** JWK of the signing device's public key. */
  publicKeyJwk: JsonWebKey;
  /** Short fingerprint of the public key for display/audit. */
  keyFingerprint: string;
  algorithm: typeof SIGNING_ALGORITHM;
  /** ISO-8601 signing time (informational; included in tamper checks). */
  signedAt: string;
}

export async function signAssessment<P>(
  payload: P,
  keyPair: AssessmentKeyPair,
  signedAt: string = new Date().toISOString(),
): Promise<SignedAssessment<P>> {
  const canonical = stableStringify(payload);
  const payloadHash = await sha256Hex(canonical);
  const key = await importPrivateKey(keyPair.privateKeyJwk);
  const sig = await subtle.sign(SIGN_PARAMS, key, encodeUtf8(canonical));
  return {
    payload,
    payloadHash,
    signature: bytesToBase64(new Uint8Array(sig)),
    publicKeyJwk: keyPair.publicKeyJwk,
    keyFingerprint: await publicKeyFingerprint(keyPair.publicKeyJwk),
    algorithm: SIGNING_ALGORITHM,
    signedAt,
  };
}

export interface VerificationResult {
  valid: boolean;
  checks: {
    hashMatches: boolean;
    signatureValid: boolean;
  };
  reasons: string[];
}

export async function verifyAssessment<P>(
  signed: SignedAssessment<P>,
): Promise<VerificationResult> {
  const reasons: string[] = [];
  const canonical = stableStringify(signed.payload);
  const recomputedHash = await sha256Hex(canonical);
  const hashMatches = recomputedHash === signed.payloadHash;
  if (!hashMatches) {
    reasons.push('Payload hash mismatch — the assessment data was modified after signing.');
  }

  let signatureValid = false;
  try {
    const key = await importPublicKey(signed.publicKeyJwk);
    signatureValid = await subtle.verify(
      SIGN_PARAMS,
      key,
      base64ToBytes(signed.signature) as BufferSource,
      encodeUtf8(canonical),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    reasons.push('Digital signature is invalid for this payload and public key.');
  }

  return {
    valid: hashMatches && signatureValid,
    checks: { hashMatches, signatureValid },
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Hash-chained audit trail
// ---------------------------------------------------------------------------

export interface AuditEntry {
  /** Sequence number, starting at 0. */
  index: number;
  /** ISO-8601 event time. */
  at: string;
  /** Event name, e.g. "captured", "analyzed", "signed", "synced". */
  event: string;
  /** Arbitrary structured details for the event. */
  details: Record<string, unknown>;
  /** Hash of the previous entry ("GENESIS" for the first). */
  prevHash: string;
  /** SHA-256 over (prevHash + canonical entry body). */
  entryHash: string;
}

export const GENESIS_HASH = 'GENESIS';

async function computeEntryHash(
  entry: Omit<AuditEntry, 'entryHash'>,
): Promise<string> {
  const body = stableStringify({
    index: entry.index,
    at: entry.at,
    event: entry.event,
    details: entry.details,
  });
  return sha256Hex(entry.prevHash + body);
}

export async function appendAuditEntry(
  trail: AuditEntry[],
  event: string,
  details: Record<string, unknown>,
  at: string = new Date().toISOString(),
): Promise<AuditEntry[]> {
  const prevHash = trail.length ? trail[trail.length - 1]!.entryHash : GENESIS_HASH;
  const partial = { index: trail.length, at, event, details, prevHash };
  const entryHash = await computeEntryHash(partial);
  return [...trail, { ...partial, entryHash }];
}

export interface AuditVerification {
  valid: boolean;
  /** Index of the first broken link, if any. */
  brokenAt: number | null;
  reason: string | null;
}

export async function verifyAuditTrail(trail: AuditEntry[]): Promise<AuditVerification> {
  for (let i = 0; i < trail.length; i++) {
    const entry = trail[i]!;
    const expectedPrev = i === 0 ? GENESIS_HASH : trail[i - 1]!.entryHash;
    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} does not chain to the previous entry (prevHash mismatch).`,
      };
    }
    if (entry.index !== i) {
      return { valid: false, brokenAt: i, reason: `Entry ${i} has wrong sequence number.` };
    }
    const recomputed = await computeEntryHash(entry);
    if (recomputed !== entry.entryHash) {
      return {
        valid: false,
        brokenAt: i,
        reason: `Entry ${i} content was altered (entryHash mismatch).`,
      };
    }
  }
  return { valid: true, brokenAt: null, reason: null };
}

// ---------------------------------------------------------------------------
// Tamper detection
// ---------------------------------------------------------------------------

/** Physical plausibility bounds for a vertical-jump assessment payload. */
export interface PlausibilityBounds {
  maxJumpHeightM: number;
  maxFlightTimeS: number;
  maxRelativePowerWkg: number;
}

export const DEFAULT_BOUNDS: PlausibilityBounds = {
  // World-class standing vertical jumps top out near 1.2 m; leave headroom.
  maxJumpHeightM: 1.35,
  maxFlightTimeS: 1.05,
  maxRelativePowerWkg: 90,
};

export interface TamperReport {
  tampered: boolean;
  reasons: string[];
  verification: VerificationResult;
  audit: AuditVerification | null;
}

/**
 * Full integrity evaluation of a signed assessment, optionally with its
 * audit trail. Combines cryptographic verification with physical
 * plausibility screening of the metric values themselves.
 */
export async function detectTampering(
  signed: SignedAssessment<Record<string, unknown>>,
  trail: AuditEntry[] | null = null,
  bounds: PlausibilityBounds = DEFAULT_BOUNDS,
): Promise<TamperReport> {
  const reasons: string[] = [];
  const verification = await verifyAssessment(signed);
  if (!verification.valid) reasons.push(...verification.reasons);

  let audit: AuditVerification | null = null;
  if (trail) {
    audit = await verifyAuditTrail(trail);
    if (!audit.valid && audit.reason) reasons.push(audit.reason);
  }

  const metrics = (signed.payload as { metrics?: Record<string, unknown> }).metrics ?? {};
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const jumpHeight =
    num((metrics as { jumpHeightM?: unknown }).jumpHeightM);
  if (jumpHeight !== null && (jumpHeight < 0 || jumpHeight > bounds.maxJumpHeightM)) {
    reasons.push(
      `Jump height ${jumpHeight.toFixed(2)} m is outside the physically plausible range.`,
    );
  }
  const flightTime = num((metrics as { flightTimeS?: unknown }).flightTimeS);
  if (flightTime !== null && (flightTime < 0 || flightTime > bounds.maxFlightTimeS)) {
    reasons.push(
      `Flight time ${flightTime.toFixed(3)} s is outside the physically plausible range.`,
    );
  }
  if (jumpHeight !== null && flightTime !== null && flightTime > 0) {
    // Cross-check: height implied by flight time must roughly agree.
    const implied = (9.80665 * flightTime * flightTime) / 8;
    if (Math.abs(implied - jumpHeight) > Math.max(0.12, implied * 0.45)) {
      reasons.push(
        'Flight time and jump height are mutually inconsistent — values were likely edited.',
      );
    }
  }
  const relPower = num((metrics as { relativePowerWkg?: unknown }).relativePowerWkg);
  if (relPower !== null && (relPower < 0 || relPower > bounds.maxRelativePowerWkg)) {
    reasons.push(`Relative power ${relPower.toFixed(1)} W/kg is not physiologically plausible.`);
  }

  return {
    tampered: reasons.length > 0,
    reasons,
    verification,
    audit,
  };
}
