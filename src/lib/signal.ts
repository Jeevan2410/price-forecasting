import type { ForecastPoint } from "./schema";

/**
 * Sell / hold decision for a farmer holding dried arecanut.
 *
 * Holding to week h costs a share of the crop (storage loss, moisture, pests) plus the
 * opportunity cost of cash not received today. The forecast quantiles give the price
 * distribution at h. We pick the week with the best median net gain and ask how likely
 * that gain is. See docs/PLAN.md §7.
 */

export type Action = "SELL_NOW" | "HOLD" | "SELL_PART";

export interface SignalParams {
  /** Share of stock lost per month in storage, in percent. */
  storageLossPctPerMonth: number;
  /** Annual interest / opportunity cost of money, in percent. */
  interestPctPerYear: number;
  /** Minimum median gain (percent of today's price) that makes holding worthwhile. */
  minGainPct: number;
  /** Probability of beating today's price needed for a full HOLD. */
  holdConfidence: number;
  /** Flag a downside risk when the P10 outcome loses more than this percent. */
  downsideFlagPct: number;
}

export const DEFAULT_PARAMS: SignalParams = {
  storageLossPctPerMonth: 0.5,
  interestPctPerYear: 12,
  minGainPct: 3,
  holdConfidence: 0.65,
  downsideFlagPct: 8,
};

export interface HorizonOutcome {
  h: number;
  week: string;
  price: { p10: number; p50: number; p90: number };
  /** Net value per quintal of holding to this week, minus selling today (₹). */
  gain: { p10: number; p50: number; p90: number };
  gainPct: number;
  /** Probability that holding to this week beats selling today, after costs. */
  probGain: number;
  /** Price the market must reach at week h just to break even. */
  breakEven: number;
}

export interface Signal {
  action: Action;
  current: number;
  best: HorizonOutcome;
  horizons: HorizonOutcome[];
  downsideRisk: boolean;
  params: SignalParams;
}

const WEEKS_PER_MONTH = 52 / 12;
const Z90 = 1.2815515655446004; // standard normal 90th percentile

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** P(price > threshold) for a log-normal fitted to the P10/P50/P90 forecast. */
export function probAbove(threshold: number, q: { p10: number; p50: number; p90: number }): number {
  const sigma = (Math.log(q.p90) - Math.log(q.p10)) / (2 * Z90);
  if (!(sigma > 1e-9)) return q.p50 > threshold ? 1 : 0;
  return 1 - normalCdf((Math.log(threshold) - Math.log(q.p50)) / sigma);
}

export function holdingCosts(h: number, params: SignalParams) {
  const lossFrac = Math.min(0.99, (params.storageLossPctPerMonth / 100) * (h / WEEKS_PER_MONTH));
  const interestFrac = (params.interestPctPerYear / 100) * (h / 52);
  return { lossFrac, interestFrac };
}

export function evaluateHorizon(
  current: number,
  point: ForecastPoint,
  params: SignalParams,
): HorizonOutcome {
  const { lossFrac, interestFrac } = holdingCosts(point.h, params);
  const cashToday = current * (1 + interestFrac);
  const net = (p: number) => p * (1 - lossFrac) - cashToday;
  const breakEven = cashToday / (1 - lossFrac);
  const price = { p10: point.p10, p50: point.p50, p90: point.p90 };
  const gain = { p10: net(point.p10), p50: net(point.p50), p90: net(point.p90) };
  return {
    h: point.h,
    week: point.week,
    price,
    gain,
    gainPct: (gain.p50 / current) * 100,
    probGain: probAbove(breakEven, price),
    breakEven,
  };
}

export function computeSignal(
  current: number,
  forecast: ForecastPoint[],
  overrides: Partial<SignalParams> = {},
): Signal | null {
  if (!(current > 0) || forecast.length === 0) return null;
  const params = { ...DEFAULT_PARAMS, ...overrides };
  const horizons = [...forecast]
    .sort((a, b) => a.h - b.h)
    .map((p) => evaluateHorizon(current, p, params));

  // Earliest week wins ties: the same money sooner is better.
  const best = horizons.reduce((acc, o) => (o.gain.p50 > acc.gain.p50 ? o : acc));

  let action: Action;
  if (best.gainPct < params.minGainPct) action = "SELL_NOW";
  else if (best.probGain >= params.holdConfidence) action = "HOLD";
  else action = "SELL_PART";

  const downsideRisk = (best.gain.p10 / current) * 100 < -params.downsideFlagPct;
  return { action, current, best, horizons, downsideRisk, params };
}

/** Revenue comparison for a given quantity (quintals). */
export function revenuePlan(signal: Signal, quantity: number) {
  const now = signal.current * quantity;
  const { lossFrac } = holdingCosts(signal.best.h, signal.params);
  const kept = quantity * (1 - lossFrac);
  return {
    now,
    hold: {
      p10: signal.best.price.p10 * kept,
      p50: signal.best.price.p50 * kept,
      p90: signal.best.price.p90 * kept,
    },
    extra: signal.best.gain.p50 * quantity,
    // SELL_PART: sell half now, hold half to the best week.
    split: now / 2 + (signal.best.price.p50 * kept) / 2,
  };
}
