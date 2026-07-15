/**
 * Badge & achievement evaluation.
 *
 * Pure functions that decide which badges an athlete has earned from their
 * assessment history. Shared by client (optimistic UI) and server
 * (authoritative award) so both agree on criteria.
 */

export interface AthleteStats {
  assessmentCount: number;
  bestJumpHeightM: number;
  bestRelativePowerWkg: number;
  bestSymmetryScore: number;
  bestMovementQuality: number;
  /** Number of distinct calendar days with at least one assessment. */
  activeDays: number;
  /** Current consecutive-day streak. */
  streakDays: number;
  /** Best single improvement between consecutive bests, in metres. */
  bestImprovementM: number;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  /** Returns progress in [0,1]; ≥1 means earned. */
  progress: (s: AthleteStats) => number;
}

const ratio = (value: number, target: number): number =>
  target <= 0 ? 0 : Math.min(1, Math.max(0, value / target));

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first-jump',
    name: 'First Flight',
    description: 'Complete your first verified assessment.',
    tier: 'bronze',
    icon: 'rocket',
    progress: (s) => ratio(s.assessmentCount, 1),
  },
  {
    id: 'ten-assessments',
    name: 'Dedicated',
    description: 'Complete 10 assessments.',
    tier: 'silver',
    icon: 'flame',
    progress: (s) => ratio(s.assessmentCount, 10),
  },
  {
    id: 'half-meter-club',
    name: 'Half-Metre Club',
    description: 'Record a vertical jump of 50 cm or higher.',
    tier: 'gold',
    icon: 'trending-up',
    progress: (s) => ratio(s.bestJumpHeightM, 0.5),
  },
  {
    id: 'sky-walker',
    name: 'Sky Walker',
    description: 'Record a vertical jump of 70 cm or higher.',
    tier: 'platinum',
    icon: 'zap',
    progress: (s) => ratio(s.bestJumpHeightM, 0.7),
  },
  {
    id: 'power-house',
    name: 'Power House',
    description: 'Reach 50 W/kg of relative power.',
    tier: 'gold',
    icon: 'bolt',
    progress: (s) => ratio(s.bestRelativePowerWkg, 50),
  },
  {
    id: 'balanced',
    name: 'Perfectly Balanced',
    description: 'Achieve a symmetry score of 95 or above.',
    tier: 'silver',
    icon: 'scale',
    progress: (s) => ratio(s.bestSymmetryScore, 95),
  },
  {
    id: 'technician',
    name: 'The Technician',
    description: 'Achieve a movement-quality score of 90 or above.',
    tier: 'gold',
    icon: 'target',
    progress: (s) => ratio(s.bestMovementQuality, 90),
  },
  {
    id: 'week-streak',
    name: 'On a Roll',
    description: 'Train on 7 consecutive days.',
    tier: 'silver',
    icon: 'calendar',
    progress: (s) => ratio(s.streakDays, 7),
  },
  {
    id: 'consistent',
    name: 'Ever Present',
    description: 'Be active on 30 different days.',
    tier: 'gold',
    icon: 'award',
    progress: (s) => ratio(s.activeDays, 30),
  },
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    description: 'Improve your personal best by 5 cm in one leap.',
    tier: 'platinum',
    icon: 'sparkles',
    progress: (s) => ratio(s.bestImprovementM, 0.05),
  },
];

export interface EarnedBadge {
  id: string;
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  earned: boolean;
  progress: number;
}

export function evaluateBadges(stats: AthleteStats): EarnedBadge[] {
  return BADGE_DEFINITIONS.map((def) => {
    const p = Math.min(1, Math.max(0, def.progress(stats)));
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      tier: def.tier,
      icon: def.icon,
      earned: p >= 1,
      progress: Math.round(p * 100) / 100,
    };
  });
}

/** Badge ids newly earned given previous vs current stats. */
export function newlyEarnedBadges(before: AthleteStats, after: AthleteStats): string[] {
  const beforeSet = new Set(evaluateBadges(before).filter((b) => b.earned).map((b) => b.id));
  return evaluateBadges(after)
    .filter((b) => b.earned && !beforeSet.has(b.id))
    .map((b) => b.id);
}
