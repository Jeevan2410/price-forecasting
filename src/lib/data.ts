import raw from "@/data/dashboard.json";

import { DashboardSchema, type Dashboard, type Series } from "./schema";
import { computeSignal, type Signal } from "./signal";

/** Validated once per server process; a bad pipeline export fails `next build`. */
export const dashboard: Dashboard = DashboardSchema.parse(raw);

export const isDemo = dashboard.meta.dataSource === "synthetic";

const VARIETY_ORDER = ["New Variety", "Old Variety", "Coca"];

export function allSeries(): Series[] {
  return dashboard.series;
}

export function getSeries(id: string): Series | undefined {
  return dashboard.series.find((s) => s.id === id);
}

export function varieties(): string[] {
  const rank = (v: string) => {
    const i = VARIETY_ORDER.indexOf(v);
    return i === -1 ? VARIETY_ORDER.length : i;
  };
  return [...dashboard.varieties].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Markets for one variety, highest current price first. */
export function seriesForVariety(variety: string): Series[] {
  return dashboard.series
    .filter((s) => s.variety === variety)
    .sort((a, b) => b.latest.price - a.latest.price);
}

export function signalFor(series: Series): Signal | null {
  return series.stale ? null : computeSignal(series.latest.price, series.forecast);
}

/** Change of the median forecast at the last horizon versus today, in percent. */
export function outlookPct(series: Series): number | null {
  const last = series.forecast.at(-1);
  return last ? (last.p50 / series.latest.price - 1) * 100 : null;
}

/** Seasonal index averaged over every market of a variety (1.0 = yearly average). */
export function varietySeasonality(variety: string): { month: number; index: number }[] {
  const rows = dashboard.series.filter((s) => s.variety === variety && s.seasonality.length === 12);
  if (rows.length === 0) return [];
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    index: rows.reduce((acc, s) => acc + s.seasonality[i].index, 0) / rows.length,
  }));
}
