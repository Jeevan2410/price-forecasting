import Link from "next/link";

import { LangSwitch } from "./LangSwitch";
import { dashboard, isDemo } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { getDictionary, type Locale } from "@/lib/i18n";

function Logo() {
  // An areca nut: a rounded drupe with a crown. Decorative; the brand name carries meaning.
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <ellipse cx="16" cy="18" rx="10" ry="11" fill="var(--accent)" />
      <path d="M16 7c-1.5-2.5-4-3.5-6-3 1 2 3 3.5 6 3Z" fill="var(--accent-strong)" />
      <path d="M11 17c1.5-3 4-4.5 7-4.5" stroke="var(--on-accent)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function SiteHeader({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  const links = [
    { href: `/${lang}`, label: t.nav.markets },
    { href: `/${lang}/accuracy`, label: t.nav.accuracy },
    { href: `/${lang}/about`, label: t.nav.about },
  ];
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span className="text-lg">{t.brand}</span>
        </Link>
        <nav aria-label="Main" className="order-3 -mx-2 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <LangSwitch lang={lang} label={t.switchTo} />
        </div>
      </div>
      {isDemo && (
        <div role="note" className="border-t border-warn-line bg-warn-soft">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-ink sm:px-6">
            <strong className="mr-1">⚠</strong>
            {t.demoBanner}
          </p>
        </div>
      )}
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-2 px-4 py-6 text-sm text-muted sm:px-6">
        <p className="text-ink-2">{t.disclaimer}</p>
        <p>
          {t.dataUpTo(formatDate(dashboard.meta.lastObservation, lang, "medium"))} ·{" "}
          {isDemo ? t.sourceDemo : t.source}
        </p>
        <p>
          {/* A route handler returning JSON, not a page: a plain link is intended. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="underline hover:text-ink" href="/api/v1/series">
            JSON API
          </a>{" "}
          ·{" "}
          <a className="underline hover:text-ink" href="https://github.com/Jeevan2410/price-forecasting">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
