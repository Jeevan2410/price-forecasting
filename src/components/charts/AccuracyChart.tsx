"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

import { LegendLine } from "./PriceChart";
import { linear, niceDomain, niceTicks, useWidth } from "./scale";
import { getDictionary, type Locale } from "@/lib/i18n";

export interface AccuracySeries {
  name: string;
  label: string;
  color: string;
  points: { h: number; mape: number }[];
}

const HEIGHT = 260;
const M = { top: 16, right: 16, bottom: 30, left: 44 };

/** MAPE by horizon, one line per model; crosshair tooltip lists every model at the hovered horizon. */
export function AccuracyChart({
  series,
  lang,
  ariaLabel,
}: {
  series: AccuracySeries[];
  lang: Locale;
  ariaLabel: string;
}) {
  const weekLabel = getDictionary(lang).accuracy.weeksAhead;
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.h)))).sort((a, b) => a - b);
  const maxV = Math.max(...series.flatMap((s) => s.points.map((p) => p.mape)));
  const [, y1] = niceDomain(0, maxV, 4);
  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const x = linear([hs[0], hs.at(-1)!], [M.left, M.left + innerW]);
  const y = linear([0, y1], [M.top + innerH, M.top]);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const h = hs[0] + ((e.clientX - box.left) / box.width) * (hs.at(-1)! - hs[0]);
    setHover(Math.min(hs.at(-1)!, Math.max(hs[0], Math.round(h))));
  }
  function onKey(e: KeyboardEvent<SVGRectElement>) {
    const cur = hover ?? hs[0];
    if (e.key === "ArrowLeft") setHover(Math.max(hs[0], cur - 1));
    else if (e.key === "ArrowRight") setHover(Math.min(hs.at(-1)!, cur + 1));
    else return;
    e.preventDefault();
  }
  const rowsAt = (h: number) =>
    series
      .map((s) => ({ s, v: s.points.find((p) => p.h === h)?.mape }))
      .filter((r): r is { s: AccuracySeries; v: number } => r.v !== undefined)
      .sort((a, b) => a.v - b.v);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-ink-2">
        {series.map((s) => (
          <LegendLine key={s.name} color={s.color} label={s.label} />
        ))}
      </div>
      <div ref={ref} className="relative w-full">
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width="100%" role="img" aria-label={ariaLabel} className="block">
          {niceTicks(0, y1, 4).map((v) => (
            <g key={v}>
              <line x1={M.left} x2={M.left + innerW} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--axis)" : "var(--grid)"} />
              <text x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
                {v}%
              </text>
            </g>
          ))}
          {hs.map((h) => (
            <text key={h} x={x(h)} y={HEIGHT - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {h === 1 || h % 2 === 0 ? weekLabel(h) : ""}
            </text>
          ))}
          {series.map((s) => (
            <path
              key={s.name}
              d={s.points.map((p, i) => `${i ? "L" : "M"}${x(p.h)},${y(p.mape)}`).join("")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke="var(--ink-2)" />
              {rowsAt(hover).map(({ s, v }) => (
                <circle key={s.name} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            aria-label={ariaLabel}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(hs[0])}
            onBlur={() => setHover(null)}
            onKeyDown={onKey}
            style={{ outline: "none", touchAction: "pan-y" }}
          />
        </svg>
        {hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 w-[220px] rounded-lg border border-line bg-surface p-2.5 text-sm shadow-lg"
            style={{ left: Math.min(Math.max(x(hover) + 12, 8), width - 228) }}
          >
            <div className="text-xs text-muted">{weekLabel(hover)}</div>
            {rowsAt(hover).map(({ s, v }) => (
              <div key={s.name} className="mt-1 flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="tabular font-semibold">{v.toFixed(2)}%</span>
                <span className="truncate text-ink-2">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
