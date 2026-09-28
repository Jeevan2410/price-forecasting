import { describe, expect, it } from "vitest";

import type { ForecastPoint } from "./schema";
import {
  computeSignal,
  DEFAULT_PARAMS,
  holdingCosts,
  normalCdf,
  probAbove,
  revenuePlan,
} from "./signal";

const P0 = 30_000;

/** A forecast whose median drifts by `drift` per week, with a ± `spread` log band. */
function path(drift: number, spread = 0.02, weeks = 12): ForecastPoint[] {
  return Array.from({ length: weeks }, (_, i) => {
    const h = i + 1;
    const mid = P0 * Math.exp(drift * h);
    const width = spread * Math.sqrt(h);
    return {
      week: `2026-10-${String(h + 1).padStart(2, "0")}`,
      h,
      p10: Math.round(mid * Math.exp(-width)),
      p50: Math.round(mid),
      p90: Math.round(mid * Math.exp(width)),
    };
  });
}

describe("normalCdf / probAbove", () => {
  it("matches known normal quantiles", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.2815515655)).toBeCloseTo(0.9, 5);
    expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 5);
  });

  it("recovers the quantiles it was fitted to", () => {
    const q = { p10: 27_000, p50: 30_000, p90: 33_333 };
    expect(probAbove(q.p50, q)).toBeCloseTo(0.5, 3);
    expect(probAbove(q.p90, q)).toBeCloseTo(0.1, 2);
    expect(probAbove(q.p10, q)).toBeCloseTo(0.9, 2);
  });

  it("handles a zero-width forecast", () => {
    const q = { p10: 100, p50: 100, p90: 100 };
    expect(probAbove(99, q)).toBe(1);
    expect(probAbove(101, q)).toBe(0);
  });
});

describe("holdingCosts", () => {
  it("scales linearly with the horizon", () => {
    const one = holdingCosts(1, DEFAULT_PARAMS);
    const four = holdingCosts(4, DEFAULT_PARAMS);
    expect(four.interestFrac).toBeCloseTo(one.interestFrac * 4, 10);
    expect(four.lossFrac).toBeCloseTo(one.lossFrac * 4, 10);
    // 12%/yr for 52 weeks is 12%; 0.5%/month for 52 weeks is 6%.
    expect(holdingCosts(52, DEFAULT_PARAMS).interestFrac).toBeCloseTo(0.12, 10);
    expect(holdingCosts(52, DEFAULT_PARAMS).lossFrac).toBeCloseTo(0.06, 10);
  });
});

describe("computeSignal", () => {
  it("returns null without a price or forecast", () => {
    expect(computeSignal(P0, [])).toBeNull();
    expect(computeSignal(0, path(0.01))).toBeNull();
  });

  it("says SELL_NOW when prices are flat (waiting only costs money)", () => {
    const s = computeSignal(P0, path(0))!;
    expect(s.action).toBe("SELL_NOW");
    expect(s.best.gain.p50).toBeLessThan(0);
  });

  it("says HOLD when a clear rise beats the holding costs", () => {
    const s = computeSignal(P0, path(0.01, 0.01))!;
    expect(s.action).toBe("HOLD");
    expect(s.best.h).toBe(12);
    expect(s.best.gainPct).toBeGreaterThan(DEFAULT_PARAMS.minGainPct);
    expect(s.best.probGain).toBeGreaterThanOrEqual(DEFAULT_PARAMS.holdConfidence);
  });

  it("says SELL_PART when the rise is real but uncertain", () => {
    const s = computeSignal(P0, path(0.006, 0.12))!;
    expect(s.best.gainPct).toBeGreaterThan(DEFAULT_PARAMS.minGainPct);
    expect(s.action).toBe("SELL_PART");
    expect(s.downsideRisk).toBe(true);
  });

  it("picks the week with the best median gain, earliest on ties", () => {
    const f = path(0.01, 0.01).map((p) => (p.h >= 6 ? { ...p, p50: path(0.01)[5].p50 } : p));
    const s = computeSignal(P0, f, { interestPctPerYear: 0, storageLossPctPerMonth: 0 })!;
    expect(s.best.h).toBe(6);
  });

  it("never becomes more eager to hold as costs rise", () => {
    const rank = { SELL_NOW: 0, SELL_PART: 1, HOLD: 2 } as const;
    let prev = Infinity;
    for (const interest of [0, 6, 12, 24, 48]) {
      const s = computeSignal(P0, path(0.005, 0.02), { interestPctPerYear: interest })!;
      expect(rank[s.action]).toBeLessThanOrEqual(prev);
      prev = rank[s.action];
    }
    expect(prev).toBe(rank.SELL_NOW);
  });

  it("break-even price makes the median gain exactly zero", () => {
    const s = computeSignal(P0, path(0.01))!;
    for (const o of s.horizons) {
      const { lossFrac, interestFrac } = holdingCosts(o.h, s.params);
      expect(o.breakEven * (1 - lossFrac) - P0 * (1 + interestFrac)).toBeCloseTo(0, 6);
    }
  });
});

describe("revenuePlan", () => {
  it("is consistent with the per-quintal signal", () => {
    const s = computeSignal(P0, path(0.01, 0.01))!;
    const plan = revenuePlan(s, 20);
    expect(plan.now).toBe(P0 * 20);
    expect(plan.extra).toBeCloseTo(s.best.gain.p50 * 20, 6);
    expect(plan.hold.p10).toBeLessThanOrEqual(plan.hold.p50);
    expect(plan.hold.p50).toBeLessThanOrEqual(plan.hold.p90);
    expect(plan.split).toBeCloseTo((plan.now + plan.hold.p50) / 2, 6);
  });
});
