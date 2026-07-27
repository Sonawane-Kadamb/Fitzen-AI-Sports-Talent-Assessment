/**
 * Comprehensive 50-Badge Achievement System.
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
  /** Multi-assessment statistics */
  bestPushups?: number;
  bestSquats?: number;
  completedTestTypes?: number;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface BadgeDefinition {
  id: string;
  name: string;
  category: 'jump' | 'pushup' | 'squat' | 'power' | 'quality' | 'streak';
  description: string;
  tier: BadgeTier;
  icon: string;
  /** Returns progress in [0,1]; ≥1 means earned. */
  progress: (s: AthleteStats) => number;
}

const ratio = (value: number, target: number): number =>
  target <= 0 ? 0 : Math.min(1, Math.max(0, value / target));

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // --- 1. VERTICAL JUMP MILESTONES (10 Badges) ---
  {
    id: 'first-jump',
    name: 'First Flight',
    category: 'jump',
    description: 'Complete your first vertical jump assessment.',
    tier: 'bronze',
    icon: 'rocket',
    progress: (s) => ratio(s.assessmentCount, 1),

  },
  {
    id: 'launchpad',
    name: 'Launchpad',
    category: 'jump',
    description: 'Reach a vertical jump height of 30 cm.',
    tier: 'bronze',
    icon: 'trending-up',
    progress: (s) => ratio(s.bestJumpHeightM, 0.30),
  },
  {
    id: 'half-meter-club',
    name: 'Half-Metre Club',
    category: 'jump',
    description: 'Record a vertical jump of 50 cm or higher.',
    tier: 'silver',
    icon: 'trending-up',
    progress: (s) => ratio(s.bestJumpHeightM, 0.50),
  },
  {
    id: 'high-flyer',
    name: 'High Flyer',
    category: 'jump',
    description: 'Reach a vertical jump height of 60 cm.',
    tier: 'silver',
    icon: 'zap',
    progress: (s) => ratio(s.bestJumpHeightM, 0.60),
  },
  {
    id: 'sky-walker',
    name: 'Sky Walker',
    category: 'jump',
    description: 'Record a vertical jump of 70 cm or higher.',
    tier: 'gold',
    icon: 'zap',
    progress: (s) => ratio(s.bestJumpHeightM, 0.70),
  },
  {
    id: 'gravity-defier',
    name: 'Gravity Defier',
    category: 'jump',
    description: 'Reach a vertical jump height of 80 cm.',
    tier: 'gold',
    icon: 'star',
    progress: (s) => ratio(s.bestJumpHeightM, 0.80),
  },
  {
    id: 'stratosphere',
    name: 'Stratosphere',
    category: 'jump',
    description: 'Reach an extraordinary jump height of 90 cm.',
    tier: 'platinum',
    icon: 'sparkles',
    progress: (s) => ratio(s.bestJumpHeightM, 0.90),
  },
  {
    id: 'moon-leap',
    name: 'Moon Leap',
    category: 'jump',
    description: 'Achieve a legendary 1.00 m vertical jump.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.bestJumpHeightM, 1.00),
  },
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    category: 'jump',
    description: 'Improve your personal best by 5 cm in one leap.',
    tier: 'gold',
    icon: 'sparkles',
    progress: (s) => ratio(s.bestImprovementM, 0.05),
  },
  {
    id: 'quantum-leap',
    name: 'Quantum Leap',
    category: 'jump',
    description: 'Improve your personal best by 10 cm in one leap.',
    tier: 'platinum',
    icon: 'rocket',
    progress: (s) => ratio(s.bestImprovementM, 0.10),
  },

  // --- 2. PUSH-UP MASTERY (10 Badges) ---
  {
    id: 'pushup-novice',
    name: 'Push-Up Novice',
    category: 'pushup',
    description: 'Log 1 valid push-up with proper form.',
    tier: 'bronze',
    icon: 'flame',
    progress: (s) => ratio(s.bestPushups ?? 0, 1),
  },
  {
    id: 'pushup-rookie',
    name: 'Push-Up Rookie',
    category: 'pushup',
    description: 'Log 5 valid push-ups in a single session.',
    tier: 'bronze',
    icon: 'flame',
    progress: (s) => ratio(s.bestPushups ?? 0, 5),
  },
  {
    id: 'pushup-warrior',
    name: 'Push-Up Warrior',
    category: 'pushup',
    description: 'Log 10 valid push-ups in a single session.',
    tier: 'silver',
    icon: 'bolt',
    progress: (s) => ratio(s.bestPushups ?? 0, 10),
  },
  {
    id: 'pushup-crusher',
    name: 'Push-Up Crusher',
    category: 'pushup',
    description: 'Log 15 valid push-ups in a single session.',
    tier: 'silver',
    icon: 'muscle',
    progress: (s) => ratio(s.bestPushups ?? 0, 15),
  },
  {
    id: 'pushup-titan',
    name: 'Push-Up Titan',
    category: 'pushup',
    description: 'Log 20 valid push-ups in a single session.',
    tier: 'gold',
    icon: 'bolt',
    progress: (s) => ratio(s.bestPushups ?? 0, 20),
  },
  {
    id: 'centurion-press',
    name: 'Centurion Press',
    category: 'pushup',
    description: 'Log 25 valid push-ups in a single session.',
    tier: 'gold',
    icon: 'muscle',
    progress: (s) => ratio(s.bestPushups ?? 0, 25),
  },
  {
    id: 'steel-chest',
    name: 'Steel Chest',
    category: 'pushup',
    description: 'Log 30 valid push-ups in a single session.',
    tier: 'platinum',
    icon: 'shield',
    progress: (s) => ratio(s.bestPushups ?? 0, 30),
  },
  {
    id: 'iron-pectorals',
    name: 'Iron Pectorals',
    category: 'pushup',
    description: 'Log 35 valid push-ups in a single session.',
    tier: 'platinum',
    icon: 'shield',
    progress: (s) => ratio(s.bestPushups ?? 0, 35),
  },
  {
    id: 'diamond-press',
    name: 'Diamond Press',
    category: 'pushup',
    description: 'Log 40 valid push-ups in a single session.',
    tier: 'platinum',
    icon: 'sparkles',
    progress: (s) => ratio(s.bestPushups ?? 0, 40),
  },
  {
    id: 'hercules-push',
    name: 'Hercules Press',
    category: 'pushup',
    description: 'Log 50 valid push-ups in a single session.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.bestPushups ?? 0, 50),
  },

  // --- 3. SQUAT MASTERY (10 Badges) ---
  {
    id: 'squat-starter',
    name: 'Squat Starter',
    category: 'squat',
    description: 'Log 1 valid parallel squat with proper form.',
    tier: 'bronze',
    icon: 'dumbbell',
    progress: (s) => ratio(s.bestSquats ?? 0, 1),
  },
  {
    id: 'squat-explorer',
    name: 'Squat Explorer',
    category: 'squat',
    description: 'Log 5 valid parallel squats in a single session.',
    tier: 'bronze',
    icon: 'dumbbell',
    progress: (s) => ratio(s.bestSquats ?? 0, 5),
  },
  {
    id: 'squat-pioneer',
    name: 'Squat Pioneer',
    category: 'squat',
    description: 'Log 10 valid parallel squats in a single session.',
    tier: 'silver',
    icon: 'trending-up',
    progress: (s) => ratio(s.bestSquats ?? 0, 10),
  },
  {
    id: 'deep-diver',
    name: 'Deep Diver',
    category: 'squat',
    description: 'Log 15 valid parallel squats in a single session.',
    tier: 'silver',
    icon: 'dumbbell',
    progress: (s) => ratio(s.bestSquats ?? 0, 15),
  },
  {
    id: 'piston-quad',
    name: 'Piston Quad',
    category: 'squat',
    description: 'Log 20 valid parallel squats in a single session.',
    tier: 'gold',
    icon: 'bolt',
    progress: (s) => ratio(s.bestSquats ?? 0, 20),
  },
  {
    id: 'iron-legs',
    name: 'Iron Legs',
    category: 'squat',
    description: 'Log 25 valid parallel squats in a single session.',
    tier: 'gold',
    icon: 'shield',
    progress: (s) => ratio(s.bestSquats ?? 0, 25),
  },
  {
    id: 'titanium-thighs',
    name: 'Titanium Thighs',
    category: 'squat',
    description: 'Log 30 valid parallel squats in a single session.',
    tier: 'platinum',
    icon: 'zap',
    progress: (s) => ratio(s.bestSquats ?? 0, 30),
  },
  {
    id: 'quadzilla',
    name: 'Quadzilla',
    category: 'squat',
    description: 'Log 35 valid parallel squats in a single session.',
    tier: 'platinum',
    icon: 'muscle',
    progress: (s) => ratio(s.bestSquats ?? 0, 35),
  },
  {
    id: 'atlas-pillar',
    name: 'Atlas Pillar',
    category: 'squat',
    description: 'Log 40 valid parallel squats in a single session.',
    tier: 'platinum',
    icon: 'shield',
    progress: (s) => ratio(s.bestSquats ?? 0, 40),
  },
  {
    id: 'olympic-depth',
    name: 'Olympic Depth',
    category: 'squat',
    description: 'Log 50 valid parallel squats in a single session.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.bestSquats ?? 0, 50),
  },

  // --- 4. RELATIVE POWER & EXPLOSIVENESS (5 Badges) ---
  {
    id: 'spark',
    name: 'Spark',
    category: 'power',
    description: 'Reach 20 W/kg of peak relative power.',
    tier: 'bronze',
    icon: 'flame',
    progress: (s) => ratio(s.bestRelativePowerWkg, 20),
  },
  {
    id: 'dynamo',
    name: 'Dynamo',
    category: 'power',
    description: 'Reach 35 W/kg of peak relative power.',
    tier: 'silver',
    icon: 'bolt',
    progress: (s) => ratio(s.bestRelativePowerWkg, 35),
  },
  {
    id: 'power-house',
    name: 'Power House',
    category: 'power',
    description: 'Reach 50 W/kg of peak relative power.',
    tier: 'gold',
    icon: 'zap',
    progress: (s) => ratio(s.bestRelativePowerWkg, 50),
  },
  {
    id: 'kinetic-monster',
    name: 'Kinetic Monster',
    category: 'power',
    description: 'Reach 65 W/kg of peak relative power.',
    tier: 'platinum',
    icon: 'sparkles',
    progress: (s) => ratio(s.bestRelativePowerWkg, 65),
  },
  {
    id: 'supercharged',
    name: 'Supercharged',
    category: 'power',
    description: 'Reach 80 W/kg of peak relative power.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.bestRelativePowerWkg, 80),
  },

  // --- 5. FORM, SYMMETRY & TECHNICAL PRECISION (5 Badges) ---
  {
    id: 'form-student',
    name: 'Form Student',
    category: 'quality',
    description: 'Achieve a movement quality score of 75 or above.',
    tier: 'bronze',
    icon: 'target',
    progress: (s) => ratio(s.bestMovementQuality, 75),
  },
  {
    id: 'balanced',
    name: 'Perfectly Balanced',
    category: 'quality',
    description: 'Achieve a bilateral symmetry score of 95 or above.',
    tier: 'silver',
    icon: 'scale',
    progress: (s) => ratio(s.bestSymmetryScore, 95),
  },
  {
    id: 'technician',
    name: 'The Technician',
    category: 'quality',
    description: 'Achieve a movement-quality score of 90 or above.',
    tier: 'gold',
    icon: 'target',
    progress: (s) => ratio(s.bestMovementQuality, 90),
  },
  {
    id: 'triple-threat',
    name: 'Triple Threat',
    category: 'quality',
    description: 'Complete all 3 assessment categories (Jump, Push-Ups, Squats).',
    tier: 'gold',
    icon: 'star',
    progress: (s) => ratio(s.completedTestTypes ?? 1, 3),
  },
  {
    id: 'biomechanic-master',
    name: 'Master Technician',
    category: 'quality',
    description: 'Achieve a 98% movement quality score.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.bestMovementQuality, 98),
  },

  // --- 6. CONSISTENCY & MILESTONES (10 Badges) ---
  {
    id: 'ten-assessments',
    name: 'Dedicated',
    category: 'streak',
    description: 'Complete 10 total assessments.',
    tier: 'bronze',
    icon: 'calendar',
    progress: (s) => ratio(s.assessmentCount, 10),
  },
  {
    id: 'silver-scholar',
    name: 'Silver Scholar',
    category: 'streak',
    description: 'Complete 20 total assessments.',
    tier: 'silver',
    icon: 'award',
    progress: (s) => ratio(s.assessmentCount, 20),
  },
  {
    id: 'gold-standard',
    name: 'Gold Standard',
    category: 'streak',
    description: 'Complete 30 total assessments.',
    tier: 'gold',
    icon: 'award',
    progress: (s) => ratio(s.assessmentCount, 30),
  },
  {
    id: 'century-club',
    name: 'Century Club',
    category: 'streak',
    description: 'Complete 50 total assessments.',
    tier: 'platinum',
    icon: 'trophy',
    progress: (s) => ratio(s.assessmentCount, 50),
  },
  {
    id: 'double-century',
    name: 'Double Century',
    category: 'streak',
    description: 'Complete 100 total assessments.',
    tier: 'platinum',
    icon: 'crown',
    progress: (s) => ratio(s.assessmentCount, 100),
  },
  {
    id: 'quick-streak',
    name: 'Hat Trick',
    category: 'streak',
    description: 'Train on 3 consecutive days.',
    tier: 'bronze',
    icon: 'flame',
    progress: (s) => ratio(s.streakDays, 3),
  },
  {
    id: 'week-streak',
    name: 'On a Roll',
    category: 'streak',
    description: 'Train on 7 consecutive days.',
    tier: 'silver',
    icon: 'calendar',
    progress: (s) => ratio(s.streakDays, 7),
  },
  {
    id: 'fortnight-focus',
    name: 'Fortnight Focus',
    category: 'streak',
    description: 'Train on 14 consecutive days.',
    tier: 'gold',
    icon: 'flame',
    progress: (s) => ratio(s.streakDays, 14),
  },
  {
    id: 'monthly-legend',
    name: 'Monthly Legend',
    category: 'streak',
    description: 'Train on 30 consecutive days.',
    tier: 'platinum',
    icon: 'star',
    progress: (s) => ratio(s.streakDays, 30),
  },
  {
    id: 'consistent',
    name: 'Ever Present',
    category: 'streak',
    description: 'Be active on 30 different calendar days.',
    tier: 'gold',
    icon: 'award',
    progress: (s) => ratio(s.activeDays, 30),
  },
];

export interface EarnedBadge {
  id: string;
  name: string;
  category: 'jump' | 'pushup' | 'squat' | 'power' | 'quality' | 'streak';
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
      category: def.category,
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
