"use client";

import { useEffect, useRef, useState } from "react";

export type Scale = ((v: number) => number) & { domain: [number, number]; range: [number, number] };

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const fn = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Scale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/** "Nice" tick values (1, 2, 2.5, 5 x 10^k steps) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Expand [min, max] outwards to the surrounding nice steps. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  const ticks = niceTicks(min, max, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : Math.abs(min) || 1;
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

export const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Width of a container element, tracked with ResizeObserver (SSR renders at `initial`). */
export function useWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Index of the item whose x is nearest to `x` (xs must be ascending). */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}
