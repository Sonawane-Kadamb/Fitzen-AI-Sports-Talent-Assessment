import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '..', '..', 'data');

/**
 * Development-only: persist a generated JWT secret under data/ so dev-server
 * restarts (file watching, engine rebuilds) don't invalidate every session.
 * Production refuses to run without an explicit FITZEN_JWT_SECRET.
 */
function devSecret(): string {
  const secretPath = join(dataDir, '.dev-jwt-secret');
  try {
    const existing = readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch { /* first run */ }
  const fresh = randomBytes(32).toString('hex');
  try {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(secretPath, fresh, { mode: 0o600 });
  } catch { /* fall back to per-process secret */ }
  return fresh;
}

export interface AppConfig {
  port: number;
  host: string;
  jwtSecret: string;
  jwtTtlSeconds: number;
  dbPath: string;
  corsOrigins: string[];
}

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

/**
 * Application configuration, sourced from environment variables with safe
 * development defaults. In production, FITZEN_JWT_SECRET must be set; a random
 * per-process secret is used otherwise (which invalidates tokens on restart —
 * fine for local dev, unacceptable for prod, hence the warning).
 */
export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const jwtSecret = process.env.FITZEN_JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('FITZEN_JWT_SECRET must be set in production.');
  }
  return {
    port: Number(envOr('FITZEN_PORT', '4000')),
    host: envOr('FITZEN_HOST', '0.0.0.0'),
    jwtSecret: jwtSecret ?? devSecret(),
    jwtTtlSeconds: Number(envOr('FITZEN_JWT_TTL', String(60 * 60 * 24 * 7))),
    dbPath: envOr('FITZEN_DB_PATH', join(here, '..', '..', '..', 'data', 'fitzen.db')),
    corsOrigins: envOr('FITZEN_CORS_ORIGINS', 'http://localhost:5173,http://localhost:4173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ...overrides,
  };
}
