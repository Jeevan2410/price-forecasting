import { formatINR } from "@/lib/format";

/**
 * Dot plot of this week's price per market. Differences between markets are a few percent,
 * which bars from zero would hide, so position (not length) carries the value.
 */
export function CompareDots({
  rows,
  highlightId,
  highlightLabel,
}: {
  rows: { id: string; label: string; price: number; href: string }[];
  highlightId: string;
  highlightLabel: string;
}) {
  const prices = rows.map((r) => r.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = Math.max((max - min) * 0.15, max * 0.01);
  const lo = min - pad;
  const hi = max + pad;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <ul className="grid gap-1">
      {rows.map((r) => {
        const me = r.id === highlightId;
        return (
          <li key={r.id} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 py-1.5 text-sm sm:grid-cols-[9rem_1fr_6rem]">
            <a href={r.href} className={`truncate hover:underline ${me ? "font-semibold text-ink" : "text-ink-2"}`}>
              {r.label}
              {me && <span className="sr-only"> ({highlightLabel})</span>}
            </a>
            <div className="relative h-4" aria-hidden="true">
              <div className="absolute inset-x-0 top-1/2 h-px bg-grid" />
              <span
                className="absolute top-1/2 block h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${pos(r.price)}%`,
                  background: me ? "var(--series-1)" : "var(--muted)",
                  boxShadow: "0 0 0 2px var(--surface)",
                  width: me ? 14 : 10,
                  height: me ? 14 : 10,
                }}
              />
            </div>
            <span className={`tabular text-right ${me ? "font-semibold" : "text-ink-2"}`}>{formatINR(r.price)}</span>
          </li>
        );
      })}
    </ul>
  );
}
