import { json, meta, notFoundJson } from "@/lib/api";
import { allSeries, getSeries } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return allSeries().map((s) => ({ id: s.id }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/v1/series/[id]">) {
  const { id } = await ctx.params;
  const series = getSeries(id);
  if (!series) return notFoundJson(id);
  return json({ meta: meta(), series });
}
