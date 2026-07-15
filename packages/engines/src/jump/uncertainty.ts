import type { EstimateWithUncertainty } from './types.js';

/** Standard gravity, m/s^2. */
export const GRAVITY = 9.80665;

/** 95% two-sided z-score. */
const Z95 = 1.959964;

export function withCi95(value: number, sigma: number): EstimateWithUncertainty {
  return {
    value,
    sigma,
    ci95: [value - Z95 * sigma, value + Z95 * sigma],
  };
}

/**
 * Uncertainty (1σ) of a flight time measured from sampled video.
 *
 * Each event edge (takeoff, landing) is located to within one frame
 * interval; treating the true event as uniformly distributed inside the
 * interval gives σ_edge = Δt/√12. Two independent edges combine to
 * σ_T = Δt·√(2/12) = Δt/√6. Sub-frame interpolation of the crossing
 * point roughly halves the residual quantization error.
 */
export function flightTimeSigmaSeconds(
  frameIntervalMs: number,
  subFrameInterpolated: boolean,
): number {
  const dt = frameIntervalMs / 1000;
  const raw = dt / Math.sqrt(6);
  return subFrameInterpolated ? raw * 0.5 : raw;
}

/**
 * Propagate flight-time uncertainty through h = g·T²/8:
 * ∂h/∂T = g·T/4, so σ_h = (g·T/4)·σ_T.
 */
export function heightSigmaFromFlightTime(flightTimeS: number, sigmaT: number): number {
  return (GRAVITY * flightTimeS / 4) * sigmaT;
}

/** Jump height from flight time: h = g·T²/8. */
export function heightFromFlightTime(flightTimeS: number): number {
  return (GRAVITY * flightTimeS * flightTimeS) / 8;
}

/**
 * Inverse-variance-weighted fusion of independent estimates of the same
 * quantity. Estimates with sigma <= 0 are ignored; if none are usable the
 * unweighted mean with the largest sigma is returned as a fallback.
 */
export function fuseEstimates(
  estimates: Array<{ value: number; sigma: number }>,
): { value: number; sigma: number } {
  const usable = estimates.filter((e) => Number.isFinite(e.value) && e.sigma > 0);
  if (usable.length === 0) {
    const values = estimates.map((e) => e.value).filter(Number.isFinite);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
    const maxSigma = Math.max(...estimates.map((e) => e.sigma), 0.05);
    return { value: mean, sigma: maxSigma };
  }
  let weightSum = 0;
  let weighted = 0;
  for (const e of usable) {
    const w = 1 / (e.sigma * e.sigma);
    weightSum += w;
    weighted += w * e.value;
  }
  return { value: weighted / weightSum, sigma: Math.sqrt(1 / weightSum) };
}

/**
 * Agreement factor between two estimates in [0,1]: 1 when identical,
 * decaying as they diverge relative to their combined uncertainty.
 */
export function estimatorAgreement(
  a: { value: number; sigma: number },
  b: { value: number; sigma: number },
): number {
  const combined = Math.sqrt(a.sigma * a.sigma + b.sigma * b.sigma);
  if (!(combined > 0)) return 0.5;
  const zDistance = Math.abs(a.value - b.value) / combined;
  return Math.exp(-0.5 * zDistance * zDistance);
}
