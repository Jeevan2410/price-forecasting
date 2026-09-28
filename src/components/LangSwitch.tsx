"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/lib/i18n";

/** Link to the same page in the other language. */
export function LangSwitch({ lang, label }: { lang: Locale; label: string }) {
  const pathname = usePathname() ?? `/${lang}`;
  const other: Locale = lang === "en" ? "kn" : "en";
  const href = pathname.replace(/^\/(en|kn)(?=\/|$)/, `/${other}`);
  return (
    <Link
      href={href}
      hrefLang={other}
      lang={other}
      className="rounded-full border border-line px-3 py-1 text-sm font-medium text-ink hover:bg-surface-2"
    >
      {label}
    </Link>
  );
}
