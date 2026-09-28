import type { Locale } from "./i18n";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹33,665 — Indian digit grouping; Latin numerals in both languages, as on mandi boards. */
export function formatINR(value: number): string {
  return inr.format(Math.round(value));
}

export function formatNumber(value: number): string {
  return num.format(Math.round(value));
}

/** Signed percentage, e.g. "+3.2%" / "−1.4%" (true minus sign). */
export function formatPct(value: number | null | undefined, digits = 1, signed = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const abs = Math.abs(value).toFixed(digits);
  if (!signed) return `${abs}%`;
  if (Number(abs) === 0) return `0${digits ? "." + "0".repeat(digits) : ""}%`;
  return `${value > 0 ? "+" : "−"}${abs}%`;
}

/** Probability 0..1 as a whole percent. */
export function formatProb(p: number): string {
  return `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

const dateFormats = {
  short: { day: "numeric", month: "short" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  month: { month: "long" },
  monthShort: { month: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** Dates are calendar days; format in UTC so server and browser always agree. */
export function formatDate(
  iso: string,
  locale: Locale,
  style: keyof typeof dateFormats = "short",
): string {
  return new Intl.DateTimeFormat(locale === "kn" ? "kn-IN" : "en-IN", {
    ...dateFormats[style],
    timeZone: "UTC",
  }).format(toDate(iso));
}

export function monthName(month: number, locale: Locale, style: "month" | "monthShort" = "month") {
  const iso = `2024-${String(month).padStart(2, "0")}-15`;
  return formatDate(iso, locale, style);
}
