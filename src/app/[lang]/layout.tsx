import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import "../globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getDictionary, isLocale, LOCALES } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${t.brand} · ${t.tagline}`, template: `%s · ${t.brand}` },
    description: t.overview.intro,
    alternates: { languages: { en: "/en", kn: "/kn" } },
    openGraph: { siteName: t.brand, locale: lang === "kn" ? "kn_IN" : "en_IN", type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SiteHeader lang={lang} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
        <SiteFooter lang={lang} />
      </body>
    </html>
  );
}
