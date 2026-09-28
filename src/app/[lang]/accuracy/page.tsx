import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccuracyChart, type AccuracySeries } from "@/components/charts/AccuracyChart";
import { Section, StatTile } from "@/components/ui";
import { dashboard, isDemo } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getDictionary, isLocale } from "@/lib/i18n";

// Fixed slot per model so a model keeps its colour whatever else is shown.
const MODEL_COLORS: Record<string, string> = {
  gbm: "var(--series-1)",
  arima: "var(--series-2)",
  seasonal_naive: "var(--series-3)",
  naive: "var(--series-4)",
};
const TABLE_HORIZONS = [1, 4, 8, 12];

export async function generateMetadata({ params }: PageProps<"/[lang]/accuracy">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).accuracy.title } : {};
}

export default async function AccuracyPage({ params }: PageProps<"/[lang]/accuracy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).accuracy;
  const bt = dashboard.backtest;
  const models = [...bt.models].sort(
    (a, b) => Object.keys(MODEL_COLORS).indexOf(a.name) - Object.keys(MODEL_COLORS).indexOf(b.name),
  );
  const ours = models.find((m) => m.name === "gbm");
  const baselines = models.filter((m) => m.name !== "gbm");
  const bestBaseline = baselines.reduce<(typeof models)[number] | undefined>(
    (acc, m) => (!acc || m.mapeAvg < acc.mapeAvg ? m : acc),
    undefined,
  );
  const at = (name: string, h: number) =>
    models.find((m) => m.name === name)?.byHorizon.find((x) => x.h === h);
  const baselineWinsShortTerm =
    Math.min(...baselines.map((m) => at(m.name, 1)?.mape ?? Infinity)) <=
    (at("gbm", 1)?.mape ?? Infinity);
  const label = (name: string, fallback: string) => t.models[name] ?? fallback;
  const shortLabel = (name: string, fallback: string) => label(name, fallback).replace(/\s*\(.*\)$/, "");

  if (!ours || bt.origins === 0) {
    return (
      <div className="pt-8">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
      </div>
    );
  }

  const chartSeries: AccuracySeries[] = models.map((m) => ({
    name: m.name,
    label: label(m.name, m.label),
    color: MODEL_COLORS[m.name] ?? "var(--muted)",
    points: m.byHorizon.map((x) => ({ h: x.h, mape: x.mape })),
  }));

  return (
    <div className="grid gap-6 pt-6 sm:pt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.title}</h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          {t.intro(bt.origins, formatDate(bt.from!, lang, "medium"), formatDate(bt.to!, lang, "medium"))}
        </p>
        {isDemo && (
          <p role="note" className="mt-3 max-w-3xl rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm">
            {t.demoNote}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile emphasis label={t.ours} value={`${ours.mapeAvg.toFixed(1)}%`} />
        {bestBaseline && (
          <StatTile
            label={t.bestBaseline(shortLabel(bestBaseline.name, bestBaseline.label))}
            value={`${bestBaseline.mapeAvg.toFixed(1)}%`}
          />
        )}
        <StatTile label={t.direction} value={`${at("gbm", 8)?.directionalAccuracy?.toFixed(0) ?? "–"}%`} />
        <StatTile
          label={t.coverage}
          value={`${at("gbm", 8)?.coverage80?.toFixed(0) ?? "–"}%`}
          sub={t.coverageTarget}
        />
      </div>

      <Section title={t.chartTitle} subtitle={t.chartSubtitle}>
        <AccuracyChart series={chartSeries} lang={lang} ariaLabel={t.chartTitle} />
        {baselineWinsShortTerm && <p className="mt-3 text-sm text-ink-2">{t.shortTermNote}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="tabular w-full min-w-[32rem] text-right text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 text-left font-medium">{t.model}</th>
                <th scope="col" className="py-2 font-medium">{t.mapeAvg}</th>
                {TABLE_HORIZONS.map((h) => (
                  <th key={h} scope="col" className="py-2 font-medium">{t.h(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.name} className={`border-b border-line last:border-0 ${m.name === "gbm" ? "font-semibold" : ""}`}>
                  <th scope="row" className="py-2 text-left font-normal">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: MODEL_COLORS[m.name] }} />
                      <span className={m.name === "gbm" ? "font-semibold" : ""}>{label(m.name, m.label)}</span>
                    </span>
                  </th>
                  <td className="py-2">{m.mapeAvg.toFixed(2)}%</td>
                  {TABLE_HORIZONS.map((h) => {
                    const x = m.byHorizon.find((b) => b.h === h);
                    return (
                      <td key={h} className="py-2">
                        {x ? `${x.mape.toFixed(2)}%` : "–"}
                        {x?.directionalAccuracy != null && (
                          <span className="block text-xs font-normal text-muted">
                            {x.directionalAccuracy.toFixed(0)}% {t.dirShort}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
