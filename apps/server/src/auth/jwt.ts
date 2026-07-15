import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal, dependency-free JWT (HS256). Sufficient and correct for a
 * first-party API where the same service signs and verifies. Tokens carry the
 * user id (`sub`), `role`, issued-at and expiry.
 */

export interface JwtPayload {
  sub: string;
  role: 'athlete' | 'coach' | 'admin';
  email: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const full: JwtPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(full);
  const signingInput = `${header}.${body}`;
  const sig = b64url(createHmac('sha256', secret).update(signingInput).digest());
  return `${signingInput}.${sig}`;
}

export type JwtVerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: string };

export function verifyJwt(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): JwtVerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [header, body, sig] = parts as [string, string, string];
  const expectedSig = createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const providedSig = fromB64url(sig);
  if (
    providedSig.length !== expectedSig.length ||
    !timingSafeEqual(providedSig, expectedSig)
  ) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: JwtPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as JwtPayload;
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}
