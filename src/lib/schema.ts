import { z } from "zod";

/**
 * Contract for src/data/dashboard.json, written by the Python pipeline (ml/src/arecanut_ml/export.py).
 * Parsing at import time means a malformed pipeline output fails the build instead of the page.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const price = z.number().int().positive();

export const ForecastPointSchema = z.object({
  week: isoDate,
  h: z.number().int().min(1),
  p10: price,
  p50: price,
  p90: price,
});

export const SeriesSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+--[a-z0-9-]+$/),
  market: z.string(),
  variety: z.string(),
  stale: z.boolean(),
  latest: z.object({
    week: isoDate,
    price,
    date: isoDate,
    modal: price,
    min: price.nullable(),
    max: price.nullable(),
  }),
  change: z.object({
    w1: z.number().nullable(),
    w4: z.number().nullable(),
    w52: z.number().nullable(),
  }),
  range52: z.object({ low: price, high: price }),
  history: z.array(
    z.object({
      week: isoDate,
      price,
      min: price.nullable(),
      max: price.nullable(),
    }),
  ),
  forecast: z.array(ForecastPointSchema),
  seasonality: z.array(
    z.object({
      month: z.number().int().min(1).max(12),
      index: z.number().positive(),
      years: z.number().int(),
    }),
  ),
});

const HorizonMetricSchema = z.object({
  h: z.number().int(),
  mape: z.number(),
  directionalAccuracy: z.number().nullable(),
  coverage80: z.number().nullable(),
  coverage80Raw: z.number().nullable().optional(),
  n: z.number().int(),
});

export const BacktestSchema = z.object({
  origins: z.number().int(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  series: z.number().int().optional(),
  champion: z.string().nullable(),
  models: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      mapeAvg: z.number(),
      byHorizon: z.array(HorizonMetricSchema),
    }),
  ),
  conformalMargins: z.record(z.string(), z.number()).optional(),
});

export const DashboardSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({
    generatedAt: z.string(),
    asOf: isoDate,
    dataSource: z.enum(["synthetic", "agmarknet"]),
    lastObservation: isoDate,
    lastWeek: isoDate,
    commodity: z.string(),
    district: z.string(),
    state: z.string(),
    unit: z.literal("INR/quintal"),
    horizonWeeks: z.number().int(),
    model: z.string(),
    features: z.object({ weather: z.boolean(), arrivals: z.boolean() }),
  }),
  markets: z.array(z.string()),
  varieties: z.array(z.string()),
  series: z.array(SeriesSchema).min(1),
  backtest: BacktestSchema,
});

export type Dashboard = z.infer<typeof DashboardSchema>;
export type Series = z.infer<typeof SeriesSchema>;
export type ForecastPoint = z.infer<typeof ForecastPointSchema>;
export type Backtest = z.infer<typeof BacktestSchema>;
