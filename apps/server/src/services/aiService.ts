import Anthropic from '@anthropic-ai/sdk';
import type { PotentialResult } from '@fitzen/engines';
import type { AthleteStatsSummary } from './statsService.ts';

/**
 * AI coaching insights.
 *
 * When an Anthropic API key is available, generates a personalised coaching
 * brief with Claude. Offline (or with no key) it degrades gracefully to a
 * deterministic, template-based brief derived from the same inputs — the
 * feature always works; the LLM upgrades its quality.
 */

export interface CoachingBriefInput {
  athleteName: string;
  ageYears: number;
  sport?: string;
  stats: AthleteStatsSummary;
  potential: PotentialResult | null;
}

export interface CoachingBrief {
  source: 'claude' | 'deterministic';
  headline: string;
  brief: string;
  focusAreas: string[];
}

function cm(m: number): string {
  return `${Math.round(m * 100)} cm`;
}

/** Deterministic fallback — rule-based but genuinely useful coaching text. */
export function deterministicBrief(input: CoachingBriefInput): CoachingBrief {
  const { athleteName, stats, potential } = input;
  const focusAreas: string[] = [];
  const lines: string[] = [];

  if (stats.assessmentCount === 0) {
    return {
      source: 'deterministic',
      headline: `Welcome, ${athleteName} — time for a baseline`,
      brief:
        'No assessments on record yet. Run 2–3 vertical jump assessments this week to establish a reliable baseline; everything else builds from there.',
      focusAreas: ['Complete first assessment', 'Establish baseline'],
    };
  }

  lines.push(
    `Best verified jump: ${cm(stats.bestJumpHeightM)} across ${stats.assessmentCount} assessment(s); latest at ${cm(stats.latestJumpHeightM)}.`,
  );

  if (potential) {
    lines.push(
      `Current performance sits at ${potential.currentPerformance}/100 with a projected potential of ${potential.potentialScore}/100 (${potential.confidenceScore}% confidence).`,
    );
    const opportunities = potential.insights.filter((i) => i.kind === 'opportunity').slice(0, 3);
    for (const opp of opportunities) {
      lines.push(opp.message);
      focusAreas.push(opp.factor);
    }
    const strengths = potential.insights.filter((i) => i.kind === 'strength').slice(0, 2);
    for (const s of strengths) lines.push(`Strength to build on: ${s.message}`);
  }

  if (stats.jumpCv > 0.1) {
    lines.push(
      'Session-to-session variability is high — prioritise consistent warm-up and jump technique before chasing bigger numbers.',
    );
    focusAreas.push('Consistency');
  }
  if (stats.streakDays >= 3) {
    lines.push(`Good momentum: a ${stats.streakDays}-day training streak. Protect the habit.`);
  }
  if (focusAreas.length === 0) focusAreas.push('Explosive strength', 'Keep testing weekly');

  return {
    source: 'deterministic',
    headline: `${athleteName}: ${cm(stats.bestJumpHeightM)} personal best`,
    brief: lines.join(' '),
    focusAreas: [...new Set(focusAreas)],
  };
}

let client: Anthropic | null = null;

function anthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export async function generateCoachingBrief(input: CoachingBriefInput): Promise<CoachingBrief> {
  const fallback = deterministicBrief(input);
  const anthropic = anthropicClient();
  if (!anthropic || input.stats.assessmentCount === 0) return fallback;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      // Deliberately short output: a tight coaching brief, not an essay.
      max_tokens: 1024,
      system:
        'You are an elite youth athletics coach writing short, actionable briefs. ' +
        'Be concrete and encouraging, never generic. Ground every claim in the data provided. ' +
        'Respond with 3-5 sentences of prose, no headers or lists.',
      messages: [
        {
          role: 'user',
          content:
            `Write a coaching brief for this athlete.\n` +
            `Name: ${input.athleteName}\nAge: ${input.ageYears}\nSport: ${input.sport ?? 'general'}\n` +
            `Stats: ${JSON.stringify(input.stats)}\n` +
            `Potential analysis: ${JSON.stringify(input.potential)}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (!text) return fallback;

    return {
      source: 'claude',
      headline: fallback.headline,
      brief: text,
      focusAreas: fallback.focusAreas,
    };
  } catch {
    // Offline-first: any API failure falls back to the deterministic brief.
    return fallback;
  }
}
