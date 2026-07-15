/**
 * Deterministic countermovement-jump pose synthesizer.
 *
 * Produces a physically consistent MediaPipe-style landmark sequence for a
 * jump of a given true height. Used by the engine test-suite and by the
 * app's guided demo mode (so the full assessment pipeline can be exercised
 * on devices without a camera).
 */

import { GRAVITY } from './uncertainty.js';
import type { Landmark, PoseFrame } from './types.js';

export interface SimulateJumpOptions {
  /** True jump height in metres (centre-of-mass rise after takeoff). */
  jumpHeightM: number;
  /** Athlete stature in centimetres — sets the on-screen body scale. */
  athleteHeightCm: number;
  /** Capture rate in frames per second. */
  fps?: number;
  /** Countermovement depth in metres. */
  countermovementDepthM?: number;
  /** Left/right asymmetry in [0,1]; 0 = perfectly symmetric. */
  asymmetry?: number;
  /** Landmark noise amplitude in normalized units. */
  noise?: number;
  /** Seed for the deterministic noise generator. */
  seed?: number;
}

/** Small deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOSE_STATURE_RATIO = 0.93;

/**
 * Vertical centre-of-mass offset (metres, + up) at time t for the modelled
 * jump. Phases: quiet standing → sinusoidal dip → sinusoidal drive →
 * ballistic flight → landing absorption → recovery.
 */
function comOffset(
  tS: number,
  phases: {
    standEnd: number;
    dipEnd: number;
    driveEnd: number;
    flightEnd: number;
    absorbEnd: number;
  },
  depth: number,
  jumpHeight: number,
): { y: number; grounded: boolean } {
  const { standEnd, dipEnd, driveEnd, flightEnd, absorbEnd } = phases;
  if (tS < standEnd) return { y: 0, grounded: true };
  if (tS < dipEnd) {
    const p = (tS - standEnd) / (dipEnd - standEnd);
    return { y: -depth * Math.sin((p * Math.PI) / 2), grounded: true };
  }
  if (tS < driveEnd) {
    const p = (tS - dipEnd) / (driveEnd - dipEnd);
    return { y: -depth * Math.cos((p * Math.PI) / 2), grounded: true };
  }
  if (tS < flightEnd) {
    const tf = tS - driveEnd;
    const T = flightEnd - driveEnd;
    const v0 = (GRAVITY * T) / 2;
    return { y: Math.max(0, v0 * tf - 0.5 * GRAVITY * tf * tf), grounded: false };
  }
  if (tS < absorbEnd) {
    const p = (tS - flightEnd) / (absorbEnd - flightEnd);
    const absorbDepth = Math.min(depth * 0.8, 0.55 * jumpHeight + 0.05);
    return { y: -absorbDepth * Math.sin(p * Math.PI), grounded: true };
  }
  return { y: 0, grounded: true };
}

export function simulateJump(options: SimulateJumpOptions): PoseFrame[] {
  const {
    jumpHeightM,
    athleteHeightCm,
    fps = 30,
    countermovementDepthM = 0.28,
    asymmetry = 0.05,
    noise = 0.0035,
    seed = 42,
  } = options;

  const rand = mulberry32(seed);
  const noiseVal = () => (rand() * 2 - 1) * noise;

  const flightT = Math.sqrt((8 * jumpHeightM) / GRAVITY);
  const phases = {
    standEnd: 0.5,
    dipEnd: 0.5 + 0.35,
    driveEnd: 0.5 + 0.35 + 0.22,
    flightEnd: 0.5 + 0.35 + 0.22 + flightT,
    absorbEnd: 0.5 + 0.35 + 0.22 + flightT + 0.3,
  };
  const totalS = phases.absorbEnd + 0.4;

  const statureM = athleteHeightCm / 100;
  // Body span (nose→ankle) occupies 62% of the frame height at standing.
  const bodySpanUnits = 0.62;
  const unitsPerMeter = bodySpanUnits / (statureM * NOSE_STATURE_RATIO);

  // Standing anchor y-positions (normalized, y down).
  const ankleY0 = 0.88;
  const noseY0 = ankleY0 - bodySpanUnits;
  const hipY0 = ankleY0 - 0.53 * statureM * unitsPerMeter;
  const kneeY0 = ankleY0 - 0.285 * statureM * unitsPerMeter;
  const shoulderY0 = noseY0 + 0.10 * statureM * unitsPerMeter;

  const cx = 0.5;
  const hipHalf = 0.045;
  const shoulderHalf = 0.075;

  const frames: PoseFrame[] = [];
  const n = Math.round(totalS * fps);

  for (let i = 0; i <= n; i++) {
    const tS = i / fps;
    const { y: comM, grounded } = comOffset(tS, phases, countermovementDepthM, jumpHeightM);
    const comUnits = comM * unitsPerMeter; // + up in metres → subtract in y-down units

    // While grounded, the dip is absorbed by knee/hip flexion: ankles stay
    // planted, hips/torso drop. In flight the whole body translates.
    const flexUnits = grounded ? Math.max(0, -comUnits) : 0;
    const riseUnits = grounded ? Math.min(0, -comUnits) : -comUnits;

    const ankleLift = grounded ? 0 : -comUnits; // negative = up
    const asymShift = asymmetry * 0.012;

    const hipY = hipY0 + flexUnits + riseUnits;
    const kneeFlexF = Math.min(1, flexUnits / (0.4 * (kneeY0 - hipY0 === 0 ? 0.1 : Math.abs(hipY0 - kneeY0))));
    // Knees drift forward/outward slightly with flexion; add mild valgus with asymmetry.
    const kneeXOffset = 0.015 * kneeFlexF;

    const mk = (x: number, y: number, vis = 0.95): Landmark => ({
      x: x + noiseVal(),
      y: y + noiseVal(),
      z: 0,
      visibility: Math.min(1, Math.max(0, vis + noiseVal() * 4)),
    });

    const landmarks: Landmark[] = new Array(33)
      .fill(null)
      .map(() => mk(cx, hipY0, 0.5));

    landmarks[0] = mk(cx, noseY0 + flexUnits * 0.72 + riseUnits);            // nose
    landmarks[11] = mk(cx - shoulderHalf, shoulderY0 + flexUnits * 0.75 + riseUnits); // L shoulder
    landmarks[12] = mk(cx + shoulderHalf, shoulderY0 + flexUnits * 0.75 + riseUnits); // R shoulder
    landmarks[23] = mk(cx - hipHalf, hipY);                                   // L hip
    landmarks[24] = mk(cx + hipHalf, hipY);                                   // R hip
    landmarks[25] = mk(cx - hipHalf - kneeXOffset - asymmetry * 0.01, kneeY0 + flexUnits * 0.35 + riseUnits); // L knee
    landmarks[26] = mk(cx + hipHalf + kneeXOffset, kneeY0 + flexUnits * 0.35 + riseUnits);                    // R knee
    landmarks[27] = mk(cx - hipHalf, ankleY0 + ankleLift + (grounded ? 0 : asymShift)); // L ankle
    landmarks[28] = mk(cx + hipHalf, ankleY0 + ankleLift);                              // R ankle
    landmarks[29] = mk(cx - hipHalf - 0.01, ankleY0 + ankleLift + 0.01);      // L heel
    landmarks[30] = mk(cx + hipHalf + 0.01, ankleY0 + ankleLift + 0.01);      // R heel
    landmarks[31] = mk(cx - hipHalf + 0.02, ankleY0 + ankleLift + 0.015);     // L foot index
    landmarks[32] = mk(cx + hipHalf - 0.02, ankleY0 + ankleLift + 0.015);     // R foot index

    frames.push({ timestampMs: Math.round(tS * 1000), landmarks });
  }

  return frames;
}
