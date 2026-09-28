import type { ReactNode } from "react";

import type { Dictionary } from "@/lib/i18n";
import type { Action } from "@/lib/signal";

const ACTION_STYLE: Record<Action, string> = {
  SELL_NOW: "bg-sell-soft text-sell",
  HOLD: "bg-hold-soft text-hold",
  SELL_PART: "bg-part-soft text-part",
};

/** Icon + label: the action never relies on colour alone. */
export function ActionIcon({ action, size = 16 }: { action: Action; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (action === "HOLD") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
    );
  }
  if (action === "SELL_PART") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 2v12" />
        <path d="M8 2a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

export function ActionBadge({ action, t }: { action: Action; t: Dictionary }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${ACTION_STYLE[action]}`}
    >
      <ActionIcon action={action} />
      {t.actions[action]}
    </span>
  );
}

export function actionPanelClass(action: Action): string {
  return ACTION_STYLE[action];
}

export function StatTile({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="card min-w-0 p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={`mt-1 font-semibold tracking-tight ${emphasis ? "text-3xl" : "text-2xl"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
  );
}

/** A signed change, coloured by direction with an arrow so colour is not the only cue. */
export function Delta({ value, text }: { value: number | null; text: string }) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.05) {
    return <span className="text-muted">{text}</span>;
  }
  const up = value > 0;
  return (
    <span className={up ? "text-hold" : "text-sell"}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {text}
    </span>
  );
}

export function Section({
  title,
  subtitle,
  children,
  id,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  id?: string;
  aside?: ReactNode;
}) {
  return (
    <section id={id} className="card min-w-0 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
