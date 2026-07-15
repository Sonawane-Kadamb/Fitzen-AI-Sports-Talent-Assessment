import type { Database } from '../db.ts';
import { HttpError } from '../http/router.ts';
import { hashPassword, verifyPassword } from '../auth/password.ts';
import { newId } from '../util/id.ts';
import type { AthleteProfile, Role, Sex, UserRecord } from '../domain/types.ts';

export function findUserByEmail(db: Database, email: string) {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.toLowerCase()) as
    | { id: string; email: string; password_hash: string; role: Role; name: string; created_at: string }
    | undefined;
}

export function getUser(db: Database, id: string): UserRecord | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | { id: string; email: string; role: Role; name: string; created_at: string }
    | undefined;
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role, name: row.name, createdAt: row.created_at };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: Role;
}

export function createUser(db: Database, input: CreateUserInput): UserRecord {
  if (findUserByEmail(db, input.email)) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  if (input.password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }
  const id = newId('usr');
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, role, name, created_at) VALUES (?,?,?,?,?,?)',
  ).run(id, input.email.toLowerCase(), hashPassword(input.password), input.role, input.name, createdAt);
  db.prepare(
    'INSERT INTO settings (user_id, updated_at) VALUES (?, ?)',
  ).run(id, createdAt);
  return { id, email: input.email.toLowerCase(), role: input.role, name: input.name, createdAt };
}

export function authenticate(db: Database, email: string, password: string): UserRecord {
  const row = findUserByEmail(db, email);
  // Uniform error whether the email or the password is wrong (no enumeration).
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  return { id: row.id, email: row.email, role: row.role, name: row.name, createdAt: row.created_at };
}

export interface ProfileInput {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  massKg: number;
  midParentalHeightCm?: number;
  sport?: string;
  region?: string;
  coachId?: string;
}

export function upsertProfile(db: Database, userId: string, input: ProfileInput): AthleteProfile {
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO athlete_profiles
       (user_id, sex, birth_date, height_cm, mass_kg, mid_parental_height_cm, sport, region, coach_id, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       sex = excluded.sex,
       birth_date = excluded.birth_date,
       height_cm = excluded.height_cm,
       mass_kg = excluded.mass_kg,
       mid_parental_height_cm = excluded.mid_parental_height_cm,
       sport = excluded.sport,
       region = excluded.region,
       coach_id = excluded.coach_id,
       updated_at = excluded.updated_at`,
  ).run(
    userId,
    input.sex,
    input.birthDate,
    input.heightCm,
    input.massKg,
    input.midParentalHeightCm ?? null,
    input.sport ?? null,
    input.region ?? null,
    input.coachId ?? null,
    updatedAt,
  );
  return { userId, updatedAt, ...input };
}

export function getProfile(db: Database, userId: string): AthleteProfile | null {
  const row = db.prepare('SELECT * FROM athlete_profiles WHERE user_id = ?').get(userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    userId: String(row.user_id),
    sex: String(row.sex) as Sex,
    birthDate: String(row.birth_date),
    heightCm: Number(row.height_cm),
    massKg: Number(row.mass_kg),
    midParentalHeightCm: row.mid_parental_height_cm == null ? undefined : Number(row.mid_parental_height_cm),
    sport: row.sport == null ? undefined : String(row.sport),
    region: row.region == null ? undefined : String(row.region),
    coachId: row.coach_id == null ? undefined : String(row.coach_id),
    updatedAt: String(row.updated_at),
  };
}

/** Athletes assigned to a coach (roster view). */
export function coachRoster(db: Database, coachId: string) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, p.sport, p.region, p.birth_date
       FROM users u JOIN athlete_profiles p ON p.user_id = u.id
       WHERE p.coach_id = ? ORDER BY u.name`,
    )
    .all(coachId) as Array<{
    id: string; name: string; email: string; sport: string | null; region: string | null; birth_date: string;
  }>;
}

export function listUsers(db: Database, role?: Role): UserRecord[] {
  const rows = (
    role
      ? db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role)
      : db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
  ) as Array<{ id: string; email: string; role: Role; name: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id, email: r.email, role: r.role, name: r.name, createdAt: r.created_at,
  }));
}
