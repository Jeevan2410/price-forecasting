"use client";

import { useMemo, useState } from "react";

import { ActionIcon, actionPanelClass } from "./ui";
import { buildAlertText, whatsappLink } from "@/lib/alert";
import { formatDate, formatINR, formatPct, formatProb } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { Series } from "@/lib/schema";
import { computeSignal, DEFAULT_PARAMS, revenuePlan } from "@/lib/signal";

function clampNum(text: string, min: number, max: number, fallback: number): number {
  const v = Number(text.replace(",", "."));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export function SignalPanel({
  series,
  lang,
  shareUrl,
}: {
  series: Series;
  lang: Locale;
  shareUrl: string;
}) {
  const t = getDictionary(lang);
  const d = t.detail;
  const [qty, setQty] = useState("10");
  const [loss, setLoss] = useState(String(DEFAULT_PARAMS.storageLossPctPerMonth));
  const [interest, setInterest] = useState(String(DEFAULT_PARAMS.interestPctPerYear));

  const quantity = clampNum(qty, 0, 100_000, 10);
  const signal = useMemo(
    () =>
      computeSignal(series.latest.price, series.forecast, {
        storageLossPctPerMonth: clampNum(loss, 0, 20, DEFAULT_PARAMS.storageLossPctPerMonth),
        interestPctPerYear: clampNum(interest, 0, 60, DEFAULT_PARAMS.interestPctPerYear),
      }),
    [series, loss, interest],
  );

  if (!signal) {
    return <p className="text-ink-2">{t.noForecast}</p>;
  }

  const plan = revenuePlan(signal, quantity);
  const bestDate = formatDate(signal.best.week, lang);
  const gainPct = formatPct(signal.best.gainPct);
  const prob = formatProb(signal.best.probGain);
  const headline =
    signal.action === "HOLD" ? t.actionLong.HOLD(bestDate) : t.actionLong[signal.action];
  const explanation =
    signal.action === "SELL_NOW"
      ? t.explain.SELL_NOW(gainPct, formatPct(signal.params.minGainPct, 0, false))
      : t.explain[signal.action](bestDate, gainPct, prob);

  return (
    <div className="grid gap-5">
      <div className={`rounded-xl p-4 sm:p-5 ${actionPanelClass(signal.action)}`} aria-live="polite">
        <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ActionIcon action={signal.action} size={24} />
          <span>{headline}</span>
        </div>
        <p className="mt-2 text-ink">{explanation}</p>
        {signal.downsideRisk && (
          <p className="mt-2 text-sm font-medium text-ink">
            ⚠ {t.downside(formatINR(Math.abs(signal.best.gain.p10)) + t.perQuintal)}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-3">
        <KeyFigure label={d.bestWeek} value={signal.action === "SELL_NOW" ? t.actions.SELL_NOW : bestDate} />
        <KeyFigure
          label={d.expectedGain}
          value={`${signal.best.gain.p50 >= 0 ? "+" : "−"}${formatINR(Math.abs(signal.best.gain.p50))}`}
          sub={`${d.perQtl} · ${gainPct}`}
        />
        <KeyFigure label={d.chance} value={prob} />
      </dl>

      <div className="rounded-xl border border-line p-4">
        <h3 className="font-semibold">{d.calcTitle}</h3>
        <p className="mt-0.5 text-sm text-ink-2">{d.calcIntro}</p>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
          <NumberField label={d.quantity} value={qty} onChange={setQty} step="1" min="0" />
          <NumberField label={d.storageLoss} value={loss} onChange={setLoss} step="0.1" min="0" />
          <NumberField label={d.interest} value={interest} onChange={setInterest} step="0.5" min="0" />
        </div>
        <dl className="tabular mt-4 grid gap-2 text-sm">
          <PlanRow label={d.sellNowValue} value={formatINR(plan.now)} strong={signal.action === "SELL_NOW"} />
          <PlanRow
            label={d.holdValue(bestDate)}
            value={formatINR(plan.hold.p50)}
            sub={`${formatINR(plan.hold.p10)} – ${formatINR(plan.hold.p90)}`}
            strong={signal.action === "HOLD"}
          />
          <PlanRow label={d.splitValue} value={formatINR(plan.split)} strong={signal.action === "SELL_PART"} />
          <PlanRow
            label={d.extra}
            value={`${plan.extra >= 0 ? "+" : "−"}${formatINR(Math.abs(plan.extra))}`}
          />
        </dl>

        <details className="mt-4 text-sm">
          <summary className="text-ink-2">{d.planTitle}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="tabular w-full min-w-[26rem] text-right">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 text-left font-medium">{d.week}</th>
                  <th className="py-1 font-medium">{d.mid}</th>
                  <th className="py-1 font-medium">{d.breakEven}</th>
                  <th className="py-1 font-medium">{d.gainShort}</th>
                  <th className="py-1 font-medium">{d.chanceShort}</th>
                </tr>
              </thead>
              <tbody>
                {signal.horizons.map((o) => (
                  <tr key={o.h} className={`border-t border-line ${o.h === signal.best.h ? "font-semibold" : ""}`}>
                    <td className="py-1 text-left">{formatDate(o.week, lang)}</td>
                    <td className="py-1">{formatINR(o.price.p50)}</td>
                    <td className="py-1">{formatINR(o.breakEven)}</td>
                    <td className="py-1">{`${o.gain.p50 >= 0 ? "+" : "−"}${formatINR(Math.abs(o.gain.p50))}`}</td>
                    <td className="py-1">{formatProb(o.probGain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <a
        href={whatsappLink(buildAlertText(series, signal, lang, shareUrl))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-strong"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
        </svg>
        {d.share}
      </a>
    </div>
  );
}

function KeyFigure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight">{value}</dd>
      {sub && <dd className="text-sm text-muted">{sub}</dd>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
  min: string;
}) {
  return (
    <label className="grid min-w-0 content-end gap-1 text-sm">
      <span className="text-ink-2">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-full min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink"
      />
    </label>
  );
}

function PlanRow({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 border-t border-line pt-2 ${strong ? "font-semibold" : ""}`}>
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right">
        {value}
        {sub && <span className="ml-2 text-xs font-normal text-muted">{sub}</span>}
      </dd>
    </div>
  );
}
