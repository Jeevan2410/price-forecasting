import Link from "next/link";
import { notFound } from "next/navigation";

import { SeasonChart } from "@/components/charts/SeasonChart";
import { ActionBadge, Delta, Section, StatTile } from "@/components/ui";
import {
  dashboard,
  outlookPct,
  seriesForVariety,
  signalFor,
  varieties,
  varietySeasonality,
} from "@/lib/data";
import { formatDate, formatINR, formatPct, monthName } from "@/lib/format";
import { getDictionary, isLocale, marketName, varietyName, type Locale } from "@/lib/i18n";

export default async function Overview({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const week = formatDate(dashboard.meta.lastWeek, lang, "medium");

  return (
    <div className="grid gap-6 pt-6 sm:pt-8">
      <div>
        <p className="text-sm font-medium text-accent">{t.weekOf(week)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.overview.title}
        </h1>
        <p className="mt-2 max-w-3xl text-ink-2">{t.overview.intro}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {varieties().map((variety) => {
          const best = seriesForVariety(variety)[0];
          return (
            <StatTile
              key={variety}
              label={
                <>
                  {varietyName(variety, lang)} · {t.overview.bestPrice}
                </>
              }
              value={
                <>
                  {formatINR(best.latest.price)}
                  <span className="text-base font-normal text-muted">{t.perQuintal}</span>
                </>
              }
              sub={
                <>
                  {marketName(best.market, lang)} ·{" "}
                  <Delta value={best.change.w1} text={`${formatPct(best.change.w1)} ${t.overview.change1w}`} />
                </>
              }
            />
          );
        })}
      </div>

      {varieties().map((variety) => (
        <VarietyTable key={variety} variety={variety} lang={lang} />
      ))}

      <div className="grid gap-6 md:grid-cols-2">
        <SeasonInsight lang={lang} />
        <Section title={t.overview.howTitle}>
          <ol className="grid gap-3">
            {t.overview.how.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-ink-2">{step}</span>
              </li>
            ))}
          </ol>
          <Link href={`/${lang}/about`} className="mt-4 inline-block text-sm font-medium text-accent underline">
            {t.nav.about} →
          </Link>
        </Section>
      </div>
    </div>
  );
}

function VarietyTable({ variety, lang }: { variety: string; lang: Locale }) {
  const t = getDictionary(lang);
  const rows = seriesForVariety(variety);
  return (
    <Section title={varietyName(variety, lang)} id={variety.toLowerCase().replace(/\s+/g, "-")}>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[20rem] text-left">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pl-4 pr-2 font-medium sm:pl-0">{t.overview.market}</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">{t.overview.price}</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">{t.overview.change1w}</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t.overview.outlook}</th>
              <th scope="col" className="py-2 pl-2 pr-4 font-medium sm:pr-0">{t.overview.signal}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const signal = signalFor(s);
              const outlook = outlookPct(s);
              return (
                <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <th scope="row" className="py-3 pl-4 pr-2 font-medium sm:pl-0">
                    <Link href={`/${lang}/market/${s.id}`} className="hover:text-accent hover:underline">
                      {marketName(s.market, lang)}
                    </Link>
                    {i === 0 && rows.length > 1 && (
                      <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
                        {t.overview.bestPrice}
                      </span>
                    )}
                  </th>
                  <td className="tabular px-2 py-3 text-right font-semibold">{formatINR(s.latest.price)}</td>
                  <td className="tabular px-2 py-3 text-right text-sm">
                    <Delta value={s.change.w1} text={formatPct(s.change.w1)} />
                  </td>
                  <td className="tabular hidden px-2 py-3 text-right text-sm sm:table-cell">
                    <Delta value={outlook} text={formatPct(outlook)} />
                  </td>
                  <td className="py-3 pl-2 pr-4 sm:pr-0">
                    {signal ? (
                      <Link href={`/${lang}/market/${s.id}`} aria-label={`${marketName(s.market, lang)}: ${t.actions[signal.action]}`}>
                        <ActionBadge action={signal.action} t={t} />
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">{t.stale}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function SeasonInsight({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  const season = varietySeasonality("New Variety");
  if (season.length !== 12) return null;
  const month = Number(dashboard.meta.lastWeek.slice(5, 7));
  const now = season[month - 1];
  const peak = season.reduce((a, b) => (b.index > a.index ? b : a));
  const pct = (x: number) => formatPct((x - 1) * 100);
  return (
    <Section title={t.overview.seasonTitle} subtitle={varietyName("New Variety", lang)}>
      <p className="text-ink-2">
        {t.overview.seasonText(monthName(month, lang), pct(now.index), monthName(peak.month, lang), pct(peak.index))}
      </p>
      <div className="mt-4">
        <SeasonChart data={season} currentMonth={month} lang={lang} tableLabel={t.detail.showTable} />
      </div>
    </Section>
  );
}
