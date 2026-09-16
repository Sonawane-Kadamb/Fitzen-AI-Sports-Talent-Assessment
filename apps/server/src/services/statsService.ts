import {
  computePotential,
  evaluateBadges,
  newlyEarnedBadges,
  type AthleteStats,
  type PotentialFeatures,
  type PotentialResult,
} from '@fitzen/engines';
import type { Database } from '../db.ts';
import type { AthleteProfile } from '../domain/types.ts';

export interface AthleteStatsSummary extends AthleteStats {
  latestJumpHeightM: number;
  totalAssessments: number;
  avgConfidence: number;
  jumpCv: number;
}

function ageYears(birthDate: string, at: Date = new Date()): number {
  const born = new Date(birthDate);
  const ms = at.getTime() - born.getTime();
  return ms / (365.2425 * 24 * 3600 * 1000);
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Aggregate an athlete's verified assessments into stats used everywhere. */
export function computeAthleteStats(db: Database, athleteId: string): AthleteStatsSummary {
  const rows = db
    .prepare(
      `SELECT test, jump_height_m, relative_power_wkg, symmetry_score, movement_quality,
              confidence, captured_at, metrics_json
       FROM assessments
       WHERE athlete_id = ? AND integrity != 'tampered'
       ORDER BY captured_at ASC`,
    )
    .all(athleteId) as Array<{
    test: string;
    jump_height_m: number;
    relative_power_wkg: number;
    symmetry_score: number;
    movement_quality: number;
    confidence: number;
    captured_at: string;
    metrics_json: string;
  }>;

  const jumpRows = rows.filter((r) => r.test === 'vertical_jump' || !r.test);
  const heights = jumpRows.map((r) => r.jump_height_m);
  const bestJump = heights.length ? Math.max(...heights) : 0;
  const latestJump = heights.length ? heights[heights.length - 1]! : 0;

  const pushupValidReps = rows
    .filter((r) => r.test === 'pushup')
    .map((r) => {
      try {
        const m = JSON.parse(r.metrics_json);
        return typeof m.validReps === 'number' ? m.validReps : 0;
      } catch {
        return 0;
      }
    });

  const squatValidReps = rows
    .filter((r) => r.test === 'squat')
    .map((r) => {
      try {
        const m = JSON.parse(r.metrics_json);
        return typeof m.validReps === 'number' ? m.validReps : 0;
      } catch {
        return 0;
      }
    });

  const bestPushups = pushupValidReps.length ? Math.max(...pushupValidReps) : 0;
  const bestSquats = squatValidReps.length ? Math.max(...squatValidReps) : 0;

  const testTypes = new Set(rows.map((r) => r.test || 'vertical_jump'));
  const completedTestTypes = testTypes.size;

  // Coefficient of variation of jump height (guard against tiny samples).
  let jumpCv = 0.12;
  if (heights.length >= 2) {
    const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    const variance =
      heights.reduce((a, b) => a + (b - mean) * (b - mean), 0) / heights.length;
    jumpCv = mean > 0 ? Math.sqrt(variance) / mean : 0.12;
  }

  // Best single improvement between consecutive personal bests.
  let runningBest = 0;
  let bestImprovement = 0;
  for (const h of heights) {
    if (h > runningBest) {
      if (runningBest > 0) bestImprovement = Math.max(bestImprovement, h - runningBest);
      runningBest = h;
    }
  }

  const days = [...new Set(rows.map((r) => dayKey(r.captured_at)))].sort();
  const streakDays = longestRecentStreak(days);

  const avgConfidence = rows.length
    ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length
    : 0;

  return {
    assessmentCount: rows.length,
    totalAssessments: rows.length,
    bestJumpHeightM: bestJump,
    latestJumpHeightM: latestJump,
    bestRelativePowerWkg: rows.length ? Math.max(...rows.map((r) => r.relative_power_wkg)) : 0,
    bestSymmetryScore: rows.length ? Math.max(...rows.map((r) => r.symmetry_score)) : 0,
    bestMovementQuality: rows.length ? Math.max(...rows.map((r) => r.movement_quality)) : 0,
    bestPushups,
    bestSquats,
    completedTestTypes,
    activeDays: days.length,
    streakDays,
    bestImprovementM: bestImprovement,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    jumpCv: Math.round(jumpCv * 1000) / 1000,
  };
}


/** Length of the streak ending at the most recent active day. */
function longestRecentStreak(sortedDays: string[]): number {
  if (sortedDays.length === 0) return 0;
  let streak = 1;
  for (let i = sortedDays.length - 1; i > 0; i--) {
    const cur = new Date(sortedDays[i]!);
    const prev = new Date(sortedDays[i - 1]!);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / (24 * 3600 * 1000));
    if (diffDays === 1) streak++;
    else break;
  }
  return streak;
}

export function athleteBadges(db: Database, athleteId: string) {
  const stats = computeAthleteStats(db, athleteId);
  const earnedRows = db
    .prepare('SELECT badge_id, earned_at FROM badges WHERE athlete_id = ?')
    .all(athleteId) as Array<{ badge_id: string; earned_at: string }>;
  const earnedAt = new Map(earnedRows.map((r) => [r.badge_id, r.earned_at]));
  return evaluateBadges(stats).map((b) => ({
    ...b,
    earnedAt: earnedAt.get(b.id) ?? null,
  }));
}

/**
 * Award any newly-earned badges after a fresh assessment, persisting them and
 * returning the ids that were just granted (for notifications).
 */
export function awardBadges(
  db: Database,
  athleteId: string,
  before: AthleteStats,
): string[] {
  const after = computeAthleteStats(db, athleteId);
  const fresh = newlyEarnedBadges(before, after);
  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO badges (athlete_id, badge_id, earned_at) VALUES (?,?,?)',
  );
  for (const id of fresh) insert.run(athleteId, id, now);
  return fresh;
}

export function potentialForAthlete(
  db: Database,
  profile: AthleteProfile,
): PotentialResult | null {
  const stats = computeAthleteStats(db, profile.userId);
  if (stats.assessmentCount === 0) return null;

  const best = db
    .prepare(
      `SELECT jump_height_m, relative_power_wkg, movement_quality, symmetry_score
       FROM assessments
       WHERE athlete_id = ? AND integrity != 'tampered'
       ORDER BY jump_height_m DESC LIMIT 1`,
    )
    .get(profile.userId) as
    | { jump_height_m: number; relative_power_wkg: number; movement_quality: number; symmetry_score: number }
    | undefined;
  if (!best) return null;

  const features: PotentialFeatures = {
    ageYears: Math.round(ageYears(profile.birthDate) * 10) / 10,
    sex: profile.sex,
    heightCm: profile.heightCm,
    massKg: profile.massKg,
    midParentalHeightCm: profile.midParentalHeightCm,
    jumpHeightM: best.jump_height_m,
    relativePowerWkg: best.relative_power_wkg,
    movementQuality: best.movement_quality,
    symmetryScore: best.symmetry_score,
    jumpCv: stats.jumpCv,
    assessmentCount: stats.assessmentCount,
  };
  return computePotential(features);
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

export function leaderboard(
  db: Database,
  opts: { metric?: 'jump' | 'pushup' | 'squat' | 'power'; region?: string; limit?: number } = {},
): LeaderboardEntry[] {
  const metric = opts.metric;
  let orderByExpr = "MAX(COALESCE(CAST(json_extract(a.metrics_json, '$.validReps') AS INT), a.jump_height_m, 0))";
  let testFilter = "";

  if (metric === 'power') {
    orderByExpr = 'MAX(a.relative_power_wkg)';
    testFilter = "AND a.test = 'vertical_jump'";
  } else if (metric === 'pushup') {
    orderByExpr = "MAX(CAST(COALESCE(json_extract(a.metrics_json, '$.validReps'), 0) AS INT))";
    testFilter = "AND a.test = 'pushup'";
  } else if (metric === 'squat') {
    orderByExpr = "MAX(CAST(COALESCE(json_extract(a.metrics_json, '$.validReps'), 0) AS INT))";
    testFilter = "AND a.test = 'squat'";
  } else if (metric === 'jump') {
    orderByExpr = 'MAX(a.jump_height_m)';
    testFilter = "AND a.test = 'vertical_jump'";
  }

  const params: string[] = [];
  let regionFilter = '';
  if (opts.region) {
    regionFilter = 'AND p.region = ?';
    params.push(opts.region);
  }
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = db
    .prepare(
      `SELECT u.id AS athlete_id, u.name AS name, p.region AS region, p.sport AS sport,
              COALESCE(MAX(CASE WHEN a.test = 'vertical_jump' THEN a.jump_height_m END), 0) AS best_jump,
              COALESCE(MAX(CASE WHEN a.test = 'vertical_jump' THEN a.relative_power_wkg END), 0) AS best_power,
              COALESCE(MAX(CASE WHEN a.test = 'pushup' THEN CAST(json_extract(a.metrics_json, '$.validReps') AS INT) END), 0) AS best_pushups,
              COALESCE(MAX(CASE WHEN a.test = 'squat' THEN CAST(json_extract(a.metrics_json, '$.validReps') AS INT) END), 0) AS best_squats,
              COUNT(a.id) AS n
       FROM users u
       JOIN assessments a ON a.athlete_id = u.id AND a.integrity = 'verified'
       LEFT JOIN athlete_profiles p ON p.user_id = u.id
       LEFT JOIN settings s ON s.user_id = u.id
       WHERE u.role = 'athlete' AND COALESCE(s.leaderboard_opt_in, 1) = 1 ${testFilter} ${regionFilter}
       GROUP BY u.id
       ORDER BY ${orderByExpr} DESC
       LIMIT ?`,
    )
    .all(...params, limit) as Array<{
    athlete_id: string;
    name: string;
    region: string | null;
    sport: string | null;
    best_jump: number;
    best_power: number;
    best_pushups: number;
    best_squats: number;
    n: number;
  }>;

  return rows.map((r, i) => ({
    rank: i + 1,
    athleteId: r.athlete_id,
    name: r.name,
    region: r.region,
    sport: r.sport,
    bestJumpHeightM: Math.round(r.best_jump * 1000) / 1000,
    bestRelativePowerWkg: Math.round(r.best_power * 10) / 10,
    bestPushups: r.best_pushups || 0,
    bestSquats: r.best_squats || 0,
    assessments: r.n,
  }));
}

