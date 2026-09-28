import { NextResponse } from "next/server";

import { dashboard } from "./data";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // Data changes once a day; let the CDN serve it and refresh in the background.
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function json(body: unknown, init: { status?: number } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: HEADERS });
}

export function notFoundJson(id: string) {
  return json(
    { error: "not_found", message: `Unknown series '${id}'. See /api/v1/series for valid ids.` },
    { status: 404 },
  );
}

export function badRequest(message: string) {
  return json({ error: "bad_request", message }, { status: 400 });
}

export function meta() {
  const m = dashboard.meta;
  return {
    dataSource: m.dataSource,
    lastObservation: m.lastObservation,
    lastWeek: m.lastWeek,
    generatedAt: m.generatedAt,
    unit: m.unit,
    district: m.district,
    model: m.model,
    ...(m.dataSource === "synthetic"
      ? { warning: "Synthetic demo data. Do not use for real selling decisions." }
      : {}),
  };
}
