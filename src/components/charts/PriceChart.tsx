"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

import { linear, nearestIndex, niceDomain, niceTicks, toMs, useWidth } from "./scale";
import { formatDate, formatINR } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";

interface HistoryPoint {
  week: string;
  price: number;
}
interface ForecastPoint {
  week: string;
  p10: number;
  p50: number;
  p90: number;
}
type Range = "1y" | "2y" | "5y";
const RANGE_WEEKS: Record<Range, number> = { "1y": 52, "2y": 104, "5y": 260 };

const HEIGHT = 300;
const HALO = { stroke: "var(--surface)", strokeWidth: 3, paintOrder: "stroke" } as const;
const M = { top: 16, right: 72, bottom: 28, left: 60 };

type Row = { x: number; week: string; actual?: number; p10?: number; p50?: number; p90?: number };

export function PriceChart({
  history,
  forecast,
  lang,
}: {
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  lang: Locale;
}) {
  const t = getDictionary(lang).detail;
  const [range, setRange] = useState<Range>("1y");
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const visible = useMemo(() => history.slice(-RANGE_WEEKS[range]), [history, range]);
  const last = visible.at(-1)!;

  const rows: Row[] = useMemo(
    () => [
      ...visible.map((h) => ({ x: toMs(h.week), week: h.week, actual: h.price })),
      ...forecast.map((f) => ({ x: toMs(f.week), week: f.week, p10: f.p10, p50: f.p50, p90: f.p90 })),
    ],
    [visible, forecast],
  );
  const xs = rows.map((r) => r.x);

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const values = rows.flatMap((r) => [r.actual, r.p10, r.p90].filter((v): v is number => v !== undefined));
  const [y0, y1] = niceDomain(Math.min(...values), Math.max(...values), 5);
  const x = linear([xs[0], xs.at(-1)!], [M.left, M.left + innerW]);
  const y = linear([y0, y1], [M.top + innerH, M.top]);

  const actualPath = visible.map((h, i) => `${i ? "L" : "M"}${x(toMs(h.week))},${y(h.price)}`).join("");
  const lastX = x(toMs(last.week));
  const lastY = y(last.price);
  const fcPath = `M${lastX},${lastY}` + forecast.map((f) => `L${x(toMs(f.week))},${y(f.p50)}`).join("");
  const bandPath =
    `M${lastX},${lastY}` +
    forecast.map((f) => `L${x(toMs(f.week))},${y(f.p90)}`).join("") +
    [...forecast].reverse().map((f) => `L${x(toMs(f.week))},${y(f.p10)}`).join("") +
    "Z";

  const yTicks = niceTicks(y0, y1, 5);
  const monthStep = range === "1y" ? 2 : range === "2y" ? 4 : 12;
  const xTicks = monthTicks(xs[0], xs[xs.length - 1], monthStep);
  const tickLabel = (iso: string) =>
    new Intl.DateTimeFormat(lang === "kn" ? "kn-IN" : "en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(iso + "T00:00:00Z"));

  const endF = forecast.at(-1);
  const active = hover !== null ? rows[hover] : null;

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = M.left + (e.clientX - box.left);
    const ms = xs[0] + ((px - M.left) / innerW) * (xs.at(-1)! - xs[0]);
    setHover(nearestIndex(xs, ms));
  }
  function onKey(e: KeyboardEvent<SVGRectElement>) {
    const cur = hover ?? visible.length - 1;
    if (e.key === "ArrowLeft") setHover(Math.max(0, cur - 1));
    else if (e.key === "ArrowRight") setHover(Math.min(rows.length - 1, cur + 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  }

  const tipLeft = active ? Math.min(Math.max(x(active.x) + 12, 8), width - 196) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
          <LegendLine color="var(--series-1)" label={t.actual} />
          <LegendLine color="var(--series-2)" label={t.forecast} />
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-sm" style={{ background: "var(--series-2)", opacity: 0.18 }} />
            {t.band}
          </span>
        </div>
        <div role="group" aria-label="Range" className="inline-flex rounded-lg border border-line p-0.5">
          {(Object.keys(RANGE_WEEKS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-md px-2.5 py-1 text-sm ${range === r ? "bg-surface-2 font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {t.range[r]}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="relative w-full">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" role="img" aria-label={`${t.chartTitle}. ${t.chartSubtitle}`} className="block">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + innerW} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
                {formatINR(v)}
              </text>
            </g>
          ))}
          {xTicks.map((iso) => (
            <text key={iso} x={x(toMs(iso))} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {tickLabel(iso)}
            </text>
          ))}
          <line x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} stroke="var(--axis)" />

          {/* The "now" divider between history and forecast. */}
          <line x1={lastX} x2={lastX} y1={M.top} y2={M.top + innerH} stroke="var(--axis)" strokeWidth={1} />
          <text x={lastX + 4} y={M.top + 10} fontSize={11} fill="var(--muted)">
            {t.today}
          </text>

          <path d={bandPath} fill="var(--series-2)" opacity={0.14} />
          <path d={actualPath} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={fcPath} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={lastX} cy={lastY} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />

          {/* Selective direct labels: today's price and the 12-week median. */}
          <text x={lastX - 8} y={lastY - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--ink)" className="tabular" {...HALO}>
            {formatINR(last.price)}
          </text>
          {endF && (
            <>
              <circle cx={x(toMs(endF.week))} cy={y(endF.p50)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
              <text x={x(toMs(endF.week)) + 8} y={y(endF.p50)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--ink)" className="tabular">
                {formatINR(endF.p50)}
              </text>
            </>
          )}

          {active && (
            <g pointerEvents="none">
              <line x1={x(active.x)} x2={x(active.x)} y1={M.top} y2={M.top + innerH} stroke="var(--ink-2)" strokeWidth={1} />
              {active.actual !== undefined && (
                <circle cx={x(active.x)} cy={y(active.actual)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
              )}
              {active.p50 !== undefined && (
                <circle cx={x(active.x)} cy={y(active.p50)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
              )}
            </g>
          )}

          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            aria-label={t.chartTitle}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(visible.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
            style={{ outline: "none", touchAction: "pan-y" }}
          />
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-2 w-[184px] rounded-lg border border-line bg-surface p-2.5 text-sm shadow-lg"
            style={{ left: tipLeft }}
            role="status"
          >
            <div className="text-xs text-muted">{formatDate(active.week, lang, "medium")}</div>
            {active.actual !== undefined ? (
              <TipRow color="var(--series-1)" label={t.actual} value={formatINR(active.actual)} />
            ) : (
              <>
                <TipRow color="var(--series-2)" label={t.forecast} value={formatINR(active.p50!)} />
                <div className="mt-0.5 pl-5 text-xs text-ink-2 tabular">
                  {formatINR(active.p10!)} – {formatINR(active.p90!)}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="text-ink-2">{t.showTable}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="tabular w-full text-right">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 text-left font-medium">{t.week}</th>
                <th className="py-1 font-medium">{t.actual}</th>
                <th className="py-1 font-medium">{t.low}</th>
                <th className="py-1 font-medium">{t.mid}</th>
                <th className="py-1 font-medium">{t.high}</th>
              </tr>
            </thead>
            <tbody>
              {[...visible.slice(-8).map((h) => ({ week: h.week, actual: h.price })), ...forecast].map((r) => (
                <tr key={r.week} className="border-t border-line">
                  <td className="py-1 text-left">{formatDate(r.week, lang, "medium")}</td>
                  <td className="py-1">{"actual" in r ? formatINR(r.actual) : "–"}</td>
                  <td className="py-1">{"p10" in r ? formatINR(r.p10) : "–"}</td>
                  <td className="py-1">{"p50" in r ? formatINR(r.p50) : "–"}</td>
                  <td className="py-1">{"p90" in r ? formatINR(r.p90) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** First-of-month dates between two timestamps, every `step` months (Jan-aligned). */
function monthTicks(fromMs: number, toMs: number, step: number): string[] {
  const out: string[] = [];
  const start = new Date(fromMs);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  while (d.getTime() <= toMs) {
    if (d.getUTCMonth() % step === 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export function LegendLine({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="tabular font-semibold">{value}</span>
      <span className="text-ink-2">{label}</span>
    </div>
  );
}
