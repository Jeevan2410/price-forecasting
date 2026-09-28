import type { NextRequest } from "next/server";

import { badRequest, json, meta, notFoundJson } from "@/lib/api";
import { getSeries } from "@/lib/data";
import { computeSignal, revenuePlan, type SignalParams } from "@/lib/signal";

const PARAMS: Record<string, { key: keyof SignalParams; min: number; max: number }> = {
  storageLoss: { key: "storageLossPctPerMonth", min: 0, max: 20 },
  interest: { key: "interestPctPerYear", min: 0, max: 60 },
  minGain: { key: "minGainPct", min: 0, max: 50 },
  confidence: { key: "holdConfidence", min: 0.5, max: 0.99 },
};

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/signal/[id]">) {
  const { id } = await ctx.params;
  const series = getSeries(id);
  if (!series) return notFoundJson(id);

  const q = req.nextUrl.searchParams;
  const overrides: Partial<SignalParams> = {};
  for (const [name, spec] of Object.entries(PARAMS)) {
    const raw = q.get(name);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      return badRequest(`${name} must be a number between ${spec.min} and ${spec.max}`);
    }
    overrides[spec.key] = value;
  }
  const quantityRaw = q.get("quantity");
  const quantity = quantityRaw === null ? null : Number(quantityRaw);
  if (quantity !== null && !(Number.isFinite(quantity) && quantity > 0 && quantity <= 100_000)) {
    return badRequest("quantity must be a number of quintals between 0 and 100000");
  }

  const signal = computeSignal(series.latest.price, series.forecast, overrides);
  if (!signal) return json({ meta: meta(), id, signal: null, reason: "no_forecast" });
  return json({
    meta: meta(),
    id,
    market: series.market,
    variety: series.variety,
    signal,
    ...(quantity !== null ? { quantity, plan: revenuePlan(signal, quantity) } : {}),
  });
}
