import { formatDate, formatINR, formatPct, formatProb } from "./format";
import { getDictionary, marketName, varietyName, type Locale } from "./i18n";
import type { Series } from "./schema";
import type { Signal } from "./signal";

/** The advice sentence shared in alerts: "Hold until 16 Nov (+3.7% expected, 72% chance)". */
export function adviceText(signal: Signal, locale: Locale): string {
  const t = getDictionary(locale);
  const date = formatDate(signal.best.week, locale);
  const detail = `${formatPct(signal.best.gainPct)}, ${formatProb(signal.best.probGain)}`;
  switch (signal.action) {
    case "HOLD":
      return `${t.actionLong.HOLD(date)} (${detail})`;
    case "SELL_PART":
      return `${t.actionLong.SELL_PART} (${detail})`;
    case "SELL_NOW":
      return t.actionLong.SELL_NOW;
  }
}

/** Plain-text message for WhatsApp groups and the alert API. */
export function buildAlertText(
  series: Series,
  signal: Signal | null,
  locale: Locale,
  url?: string,
): string {
  const t = getDictionary(locale);
  const lines = [
    t.share.header(marketName(series.market, locale), varietyName(series.variety, locale)),
    t.share.latest(formatINR(series.latest.price), formatDate(series.latest.date, locale)),
  ];
  const last = series.forecast.at(-1);
  if (last) {
    lines.push(
      t.share.forecast(last.h, formatINR(last.p50), formatINR(last.p10), formatINR(last.p90)),
    );
  }
  lines.push(signal ? t.share.signal(adviceText(signal, locale)) : t.noForecast);
  if (url) lines.push(url);
  lines.push(t.share.footer);
  return lines.join("\n");
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
