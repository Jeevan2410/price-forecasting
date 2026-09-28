import { describe, expect, it } from "vitest";

import { buildAlertText, whatsappLink } from "./alert";
import { allSeries, dashboard, getSeries, seriesForVariety, signalFor, varieties } from "./data";
import { formatDate, formatINR, formatPct } from "./format";

describe("dashboard.json contract", () => {
  it("parses (the schema check runs at import) and has series", () => {
    expect(dashboard.series.length).toBeGreaterThan(0);
    expect(new Set(allSeries().map((s) => s.id)).size).toBe(allSeries().length);
  });

  it("every live series has a full, ordered, non-crossing forecast after the last week", () => {
    for (const s of allSeries().filter((x) => !x.stale)) {
      expect(s.forecast).toHaveLength(dashboard.meta.horizonWeeks);
      expect(s.forecast.map((f) => f.h)).toEqual(
        Array.from({ length: dashboard.meta.horizonWeeks }, (_, i) => i + 1),
      );
      expect(s.forecast[0].week > dashboard.meta.lastWeek).toBe(true);
      for (const f of s.forecast) {
        expect(f.p10).toBeLessThanOrEqual(f.p50);
        expect(f.p50).toBeLessThanOrEqual(f.p90);
      }
      expect(s.history.at(-1)!.price).toBe(s.latest.price);
    }
  });

  it("orders markets by price and varieties chali-first", () => {
    const v = varieties();
    expect(v[0]).toBe("New Variety");
    const rows = seriesForVariety(v[0]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].latest.price).toBeGreaterThanOrEqual(rows[i].latest.price);
    }
  });

  it("backtest reports every model", () => {
    const names = dashboard.backtest.models.map((m) => m.name).sort();
    expect(names).toEqual(["arima", "gbm", "naive", "seasonal_naive"]);
  });
});

describe("alerts", () => {
  const series = getSeries(allSeries()[0].id)!;

  it("builds a message with market, price and advice", () => {
    const text = buildAlertText(series, signalFor(series), "en", "https://example.test/x");
    expect(text).toContain(formatINR(series.latest.price));
    expect(text).toContain("Advice:");
    expect(text).toContain("https://example.test/x");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(5);
  });

  it("builds Kannada messages and URL-encodes them for WhatsApp", () => {
    const text = buildAlertText(series, signalFor(series), "kn");
    expect(text).toMatch(/[ಀ-೿]/);
    const link = whatsappLink(text);
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.slice("https://wa.me/?text=".length))).toBe(text);
  });
});

describe("format", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(336650)).toBe("₹3,36,650");
    expect(formatINR(33665.4)).toBe("₹33,665");
  });

  it("signs percentages with a true minus", () => {
    expect(formatPct(3.21)).toBe("+3.2%");
    expect(formatPct(-1.25)).toBe("−1.3%");
    expect(formatPct(0.01)).toBe("0.0%");
    expect(formatPct(null)).toBe("–");
  });

  it("formats calendar dates without timezone drift", () => {
    expect(formatDate("2026-09-21", "en", "medium")).toBe("21 Sept 2026");
    expect(formatDate("2026-01-01", "en")).toBe("1 Jan");
  });
});
