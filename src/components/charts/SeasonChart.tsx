"use client";

import { useState } from "react";

import { linear, niceTicks, useWidth } from "./scale";
import { formatPct, monthName } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

const HEIGHT = 200;
const M = { top: 20, right: 8, bottom: 24, left: 44 };

/**
 * Diverging columns from the yearly average (0%). One hue; the current month is emphasised,
 * the others use a lighter step of the same ramp. Peak, trough and current month are labelled.
 */
export function SeasonChart({
  data,
  currentMonth,
  lang,
  tableLabel,
}: {
  data: { month: number; index: number }[];
  currentMonth: number;
  lang: Locale;
  tableLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.map((d) => ({ month: d.month, v: (d.index - 1) * 100 }));
  const maxAbs = Math.max(1, ...pts.map((p) => Math.abs(p.v)));
  const ticks = niceTicks(-maxAbs, maxAbs, 4);
  // Headroom so value labels at the bar ends never reach the month labels.
  const lim = Math.max(Math.abs(ticks[0]), Math.abs(ticks.at(-1)!), maxAbs * 1.3);
  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const y = linear([-lim, lim], [M.top + innerH, M.top]);
  const band = innerW / 12;
  const barW = Math.min(24, band * 0.62);
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a)).month;
  const trough = pts.reduce((a, b) => (b.v < a.v ? b : a)).month;
  const labelled = new Set([peak, trough, currentMonth, hover ?? -1]);

  return (
    <div>
      <div ref={ref} className="w-full">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" role="img" aria-label={tableLabel} className="block">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + innerW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} />
              <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
                {v === 0 ? "0%" : formatPct(v, 0)}
              </text>
            </g>
          ))}
          {pts.map((p, i) => {
            const cx = M.left + band * i + band / 2;
            const top = Math.min(y(p.v), y(0));
            const h = Math.max(1, Math.abs(y(p.v) - y(0)));
            const r = Math.min(4, h / 2);
            const up = p.v >= 0;
            // Rounded data end, square at the baseline.
            const x0 = cx - barW / 2;
            const x1 = cx + barW / 2;
            const d = up
              ? `M${x0},${top + h}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${top + h}Z`
              : `M${x0},${top}V${top + h - r}Q${x0},${top + h} ${x0 + r},${top + h}H${x1 - r}Q${x1},${top + h} ${x1},${top + h - r}V${top}Z`;
            const emphasised = p.month === currentMonth || p.month === hover;
            return (
              <g
                key={p.month}
                onPointerEnter={() => setHover(p.month)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p.month)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${monthName(p.month, lang)} ${formatPct(p.v)}`}
                style={{ outline: "none" }}
              >
                <rect x={cx - band / 2} y={M.top} width={band} height={innerH} fill="transparent" />
                <path d={d} fill={emphasised ? "var(--series-1)" : "var(--series-1-soft)"} />
                {labelled.has(p.month) && (
                  <text
                    x={cx}
                    y={up ? top - 5 : top + h + 12}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={p.month === currentMonth ? 600 : 400}
                    fill="var(--ink)"
                    className="tabular"
                  >
                    {formatPct(p.v)}
                  </text>
                )}
                <text x={cx} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill={p.month === currentMonth ? "var(--ink)" : "var(--muted)"}>
                  {monthName(p.month, lang, "monthShort").slice(0, lang === "kn" ? 4 : 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details className="mt-2 text-sm">
        <summary className="text-ink-2">{tableLabel}</summary>
        <table className="tabular mt-2 w-full max-w-sm text-right">
          <tbody>
            {pts.map((p) => (
              <tr key={p.month} className="border-t border-line">
                <td className="py-1 text-left">{monthName(p.month, lang)}</td>
                <td className="py-1">{formatPct(p.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
