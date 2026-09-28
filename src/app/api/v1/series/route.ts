import { json, meta } from "@/lib/api";
import { allSeries, outlookPct, signalFor } from "@/lib/data";

export const dynamic = "force-static";

export function GET() {
  return json({
    meta: meta(),
    series: allSeries().map((s) => {
      const signal = signalFor(s);
      return {
        id: s.id,
        market: s.market,
        variety: s.variety,
        stale: s.stale,
        latest: s.latest,
        change: s.change,
        outlook12wPct: outlookPct(s),
        signal: signal && {
          action: signal.action,
          bestWeek: signal.best.week,
          expectedGainPct: Number(signal.best.gainPct.toFixed(2)),
          probability: Number(signal.best.probGain.toFixed(3)),
        },
        links: { self: `/api/v1/series/${s.id}`, signal: `/api/v1/signal/${s.id}` },
      };
    }),
  });
}
