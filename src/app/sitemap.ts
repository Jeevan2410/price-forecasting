import type { MetadataRoute } from "next";

import { allSeries, dashboard } from "@/lib/data";
import { LOCALES } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date(dashboard.meta.generatedAt);
  const paths = ["", "/accuracy", "/about", ...allSeries().map((s) => `/market/${s.id}`)];
  return LOCALES.flatMap((lang) =>
    paths.map((p) => ({
      url: `${base}/${lang}${p}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: p === "" ? 1 : 0.6,
    })),
  );
}
