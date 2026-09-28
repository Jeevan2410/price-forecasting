import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SignalPanel } from "@/components/SignalPanel";
import { CompareDots } from "@/components/charts/CompareDots";
import { PriceChart } from "@/components/charts/PriceChart";
import { SeasonChart } from "@/components/charts/SeasonChart";
import { Delta, Section, StatTile } from "@/components/ui";
import { allSeries, dashboard, getSeries, seriesForVariety } from "@/lib/data";
import { formatDate, formatINR, formatPct } from "@/lib/format";
import { getDictionary, isLocale, LOCALES, marketName, varietyName } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => allSeries().map((s) => ({ lang, id: s.id })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/market/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const s = getSeries(id);
  if (!s || !isLocale(lang)) return {};
  const title = `${marketName(s.market, lang)} · ${varietyName(s.variety, lang)}`;
  return {
    title,
    description: `${title}: ${formatINR(s.latest.price)}${getDictionary(lang).perQuintal}`,
    alternates: { languages: { en: `/en/market/${id}`, kn: `/kn/market/${id}` } },
  };
}

export default async function MarketPage({ params }: PageProps<"/[lang]/market/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const s = getSeries(id);
  if (!s) notFound();
  const t = getDictionary(lang);
  const d = t.detail;
  const market = marketName(s.market, lang);
  const variety = varietyName(s.variety, lang);
  const last = s.forecast.at(-1);
  const currentMonth = Number(dashboard.meta.lastWeek.slice(5, 7));

  return (
    <div className="grid gap-6 pt-6 sm:pt-8">
      <div>
        <Link href={`/${lang}`} className="text-sm text-ink-2 hover:text-ink hover:underline">
          ← {d.back}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {market} <span className="text-ink-2">· {variety}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">{t.weekOf(formatDate(s.latest.week, lang, "medium"))}</p>
        {s.stale && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm">{t.stale}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          emphasis
          label={d.latest}
          value={
            <>
              {formatINR(s.latest.price)}
              <span className="text-base font-normal text-muted">{t.perQuintal}</span>
            </>
          }
          sub={<Delta value={s.change.w1} text={`${formatPct(s.change.w1)} · ${t.overview.change1w}`} />}
        />
        <StatTile
          label={d.lastTrade(formatDate(s.latest.date, lang))}
          value={formatINR(s.latest.modal)}
          sub={s.latest.min && s.latest.max ? `${formatINR(s.latest.min)} – ${formatINR(s.latest.max)}` : undefined}
        />
        <StatTile
          label={d.range52}
          value={`${formatINR(s.range52.low)} – ${formatINR(s.range52.high)}`}
        />
        {last && (
          <StatTile
            label={d.forecast12}
            value={formatINR(last.p50)}
            sub={`${d.likelyRange} ${formatINR(last.p10)} – ${formatINR(last.p90)}`}
          />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid min-w-0 gap-6">
          <Section title={d.chartTitle} subtitle={d.chartSubtitle}>
            <PriceChart history={s.history} forecast={s.forecast} lang={lang} />
          </Section>
          {s.seasonality.length === 12 && (
            <Section title={d.seasonTitle} subtitle={d.seasonSubtitle}>
              <SeasonChart data={s.seasonality} currentMonth={currentMonth} lang={lang} tableLabel={d.showTable} />
            </Section>
          )}
        </div>
        <div className="grid min-w-0 gap-6">
          <Section title={d.signalTitle}>
            <SignalPanel series={s} lang={lang} shareUrl={`${siteUrl()}/${lang}/market/${s.id}`} />
          </Section>
          <Section title={d.compareTitle(variety)} subtitle={d.compareSubtitle}>
            <CompareDots
              highlightId={s.id}
              highlightLabel={d.thisMarket}
              rows={seriesForVariety(s.variety).map((o) => ({
                id: o.id,
                label: marketName(o.market, lang),
                price: o.latest.price,
                href: `/${lang}/market/${o.id}`,
              }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
