import type { NextRequest } from "next/server";

import { adviceText, buildAlertText, whatsappLink } from "@/lib/alert";
import { badRequest, json, meta, notFoundJson } from "@/lib/api";
import { getSeries, signalFor } from "@/lib/data";
import { isLocale } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

/** WhatsApp-ready alert text for one series, for bots, Zapier/n8n flows and group admins. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/alert/[id]">) {
  const { id } = await ctx.params;
  const series = getSeries(id);
  if (!series) return notFoundJson(id);
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";
  if (!isLocale(lang)) return badRequest("lang must be 'en' or 'kn'");

  const signal = signalFor(series);
  const text = buildAlertText(series, signal, lang, `${siteUrl()}/${lang}/market/${id}`);
  return json({
    meta: meta(),
    id,
    lang,
    action: signal?.action ?? null,
    advice: signal ? adviceText(signal, lang) : null,
    text,
    whatsapp: whatsappLink(text),
  });
}
