/**
 * Typed API client. All requests go through `request()`, which attaches the
 * bearer token and normalizes errors. Network failures throw OfflineError so
 * callers can branch to offline behaviour.
 */

import type {
  AuditEntry,
  EarnedBadge,
  Insight,
  PotentialResult,
  SignedAssessment,
} from '@fitzen/engines';

export type Role = 'athlete' | 'coach' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  createdAt: string;
}

export interface Profile {
  userId: string;
  sex: 'male' | 'female';
  birthDate: string;
  heightCm: number;
  massKg: number;
  midParentalHeightCm?: number;
  sport?: string;
  region?: string;
  coachId?: string;
}

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
  integrity: 'verified' | 'tampered' | 'unverified';
  integrityReasons: string[];
  keyFingerprint: string;
}

export interface AthleteStats {
  assessmentCount: number;
  totalAssessments: number;
  bestJumpHeightM: number;
  latestJumpHeightM: number;
  bestRelativePowerWkg: number;
  bestSymmetryScore: number;
  bestMovementQuality: number;
  activeDays: number;
  streakDays: number;
  bestImprovementM: number;
  avgConfidence: number;
  jumpCv: number;
}

export interface LeaderboardEntry {
  rank: number;
  athleteId: string;
  name: string;
  region: string | null;
  sport: string | null;
  bestJumpHeightM: number;
  bestRelativePowerWkg: number;
  bestPushups: number;
  bestSquats: number;
  assessments: number;
}


export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  units: 'metric' | 'imperial';
  notificationsEnabled: boolean;
  leaderboardOptIn: boolean;
}

export interface CoachingBrief {
  source: 'claude' | 'deterministic';
  headline: string;
  brief: string;
  focusAreas: string[];
}

export type BadgeWithDate = EarnedBadge & { earnedAt: string | null };
export type { PotentialResult, Insight };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('You appear to be offline.');
  }
}

const TOKEN_KEY = 'fitzen.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, typeof data.error === 'string' ? data.error : `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (input: { email: string; password: string; name: string; role?: Role }) =>
    request<{ user: User; token: string }>('POST', '/api/auth/register', input),
  login: (input: { email: string; password: string }) =>
    request<{ user: User; token: string }>('POST', '/api/auth/login', input),
  me: () => request<{ user: User; profile: Profile | null }>('GET', '/api/me'),
  saveProfile: (profile: Omit<Profile, 'userId'>) =>
    request<{ profile: Profile }>('PUT', '/api/me/profile', profile),
  getSettings: () => request<{ settings: Settings }>('GET', '/api/me/settings'),
  saveSettings: (settings: Settings) =>
    request<{ settings: Settings }>('PUT', '/api/me/settings', settings),

  submitAssessment: (envelope: AssessmentEnvelope) =>
    request<{ record: AssessmentRecord; created: boolean; newBadges: string[] }>(
      'POST', '/api/assessments', envelope),
  sync: (assessments: AssessmentEnvelope[]) =>
    request<{ results: Array<{ clientId: string | null; status: string; id?: string; error?: string }> }>(
      'POST', '/api/sync', { assessments }),
  listAssessments: (athleteId?: string) =>
    request<{ assessments: AssessmentRecord[] }>(
      'GET', athleteId ? `/api/assessments?athleteId=${athleteId}` : '/api/assessments'),
  verifyAssessment: (id: string) =>
    request<{ integrity: string; reasons: string[]; auditValid: boolean }>(
      'POST', `/api/assessments/${id}/verify`, {}),

  stats: () => request<{ stats: AthleteStats; potential: PotentialResult | null }>('GET', '/api/stats/me'),
  badges: () => request<{ badges: BadgeWithDate[] }>('GET', '/api/badges/me'),
  leaderboard: (metric: 'jump' | 'pushup' | 'squat' | 'power' = 'jump', region?: string) =>
    request<{ leaderboard: LeaderboardEntry[] }>(
      'GET', `/api/leaderboard?metric=${metric}${region ? `&region=${encodeURIComponent(region)}` : ''}`),


  notifications: () => request<{ notifications: Notification[] }>('GET', '/api/notifications'),
  markAllNotificationsRead: () => request<{ updated: number }>('POST', '/api/notifications/read-all', {}),

  aiBrief: (athleteId?: string) =>
    request<{ brief: CoachingBrief }>(
      'GET', athleteId ? `/api/ai/brief?athleteId=${athleteId}` : '/api/ai/brief'),

  coachRoster: () =>
    request<{ roster: Array<{ id: string; name: string; email: string; sport: string | null; region: string | null; birth_date: string; stats: AthleteStats }> }>(
      'GET', '/api/coach/roster'),
  coachAthlete: (id: string) =>
    request<{ user: User; profile: Profile | null; stats: AthleteStats; potential: PotentialResult | null; assessments: AssessmentRecord[]; badges: BadgeWithDate[] }>(
      'GET', `/api/coach/athletes/${id}`),

  adminOverview: () =>
    request<{ overview: { users: number; athletes: number; coaches: number; assessments: number; verified: number; tampered: number; badgesAwarded: number } }>(
      'GET', '/api/admin/overview'),
  adminUsers: (role?: Role) =>
    request<{ users: User[] }>('GET', role ? `/api/admin/users?role=${role}` : '/api/admin/users'),
};
