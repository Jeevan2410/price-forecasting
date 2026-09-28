"""Build the JSON contract consumed by the web app (``src/data/dashboard.json``).

The TypeScript side validates this shape with zod (``src/lib/schema.ts``); change both together.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    COMMODITY,
    DISTRICT,
    EXPORT_HISTORY_WEEKS,
    HORIZONS,
    STALE_AFTER_WEEKS,
    STATE,
)
from .models import QCOLS

SCHEMA_VERSION = 1


def _date(ts: pd.Timestamp) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m-%d")


def _int(x: float) -> int | None:
    return None if x is None or not np.isfinite(x) else int(round(float(x)))


def _pct(new: float, old: float) -> float | None:
    if old is None or new is None or not np.isfinite(old) or not np.isfinite(new) or old == 0:
        return None
    return round((new / old - 1) * 100, 2)


def seasonal_index(g: pd.DataFrame) -> list[dict]:
    """Average ratio of each calendar month's price to its year's mean (1.0 = typical)."""
    df = g[g["observed"]].copy()
    if df.empty:
        return []
    df["year"] = df["week"].dt.year
    df["month"] = df["week"].dt.month
    monthly = df.groupby(["year", "month"])["price"].mean().reset_index()
    full_years = monthly.groupby("year")["month"].count()
    monthly = monthly[monthly["year"].isin(full_years[full_years >= 10].index)]
    if monthly.empty:
        return []
    monthly["ratio"] = monthly["price"] / monthly.groupby("year")["price"].transform("mean")
    idx = monthly.groupby("month")["ratio"].mean()
    idx = idx / idx.mean()
    return [
        {"month": int(m), "index": round(float(v), 4), "years": int(full_years.ge(10).sum())}
        for m, v in idx.items()
    ]


def series_payload(
    g: pd.DataFrame,
    daily: pd.DataFrame,
    forecast: pd.DataFrame,
    last_week: pd.Timestamp,
) -> dict:
    g = g.sort_values("week")
    market, variety, sid = g["market"].iloc[0], g["variety"].iloc[0], g["series_id"].iloc[0]
    observed = g[g["observed"]]
    last_obs_week = observed["week"].max()
    priced = g[g["price"].notna()]
    last = priced.iloc[-1]

    def price_at(weeks_back: int) -> float | None:
        target = last["week"] - pd.Timedelta(weeks=weeks_back)
        row = priced[priced["week"] <= target]
        return float(row["price"].iloc[-1]) if not row.empty else None

    recent = priced[priced["week"] > last["week"] - pd.Timedelta(weeks=52)]
    hist = priced[priced["week"] > last_week - pd.Timedelta(weeks=EXPORT_HISTORY_WEEKS)]
    d = daily[(daily["market"] == market) & (daily["variety"] == variety)].sort_values("date")
    last_day = d.iloc[-1]

    fc = forecast[forecast["series_id"] == sid].sort_values("h")
    p0 = float(last["price"])
    return {
        "id": sid,
        "market": market,
        "variety": variety,
        "stale": bool(last_obs_week < last_week - pd.Timedelta(weeks=STALE_AFTER_WEEKS)),
        "latest": {
            "week": _date(last["week"]),
            "price": _int(p0),
            "date": _date(last_day["date"]),
            "modal": _int(last_day["modal_price"]),
            "min": _int(last_day["min_price"]),
            "max": _int(last_day["max_price"]),
        },
        "change": {
            "w1": _pct(p0, price_at(1)),
            "w4": _pct(p0, price_at(4)),
            "w52": _pct(p0, price_at(52)),
        },
        "range52": {"low": _int(recent["price"].min()), "high": _int(recent["price"].max())},
        "history": [
            {
                "week": _date(r.week),
                "price": _int(r.price),
                "min": _int(r.min_price),
                "max": _int(r.max_price),
            }
            for r in hist.itertuples()
        ],
        "forecast": [
            {
                "week": _date(r.week + pd.Timedelta(weeks=int(r.h))),
                "h": int(r.h),
                "p10": _int(p0 * np.exp(r.q10)),
                "p50": _int(p0 * np.exp(r.q50)),
                "p90": _int(p0 * np.exp(r.q90)),
            }
            for r in fc.itertuples()
        ],
        "seasonality": seasonal_index(g),
    }


def build_dashboard(
    *,
    daily: pd.DataFrame,
    weekly: pd.DataFrame,
    forecast: pd.DataFrame,
    backtest: dict,
    data_source: str,
    as_of: pd.Timestamp,
    has_weather: bool,
    model_label: str,
) -> dict:
    last_week = weekly["week"].max()
    series = [
        series_payload(g, daily, forecast, last_week)
        for _, g in weekly.groupby("series_id", sort=True)
    ]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "meta": {
            "generatedAt": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "asOf": _date(as_of),
            "dataSource": data_source,
            "lastObservation": _date(daily["date"].max()),
            "lastWeek": _date(last_week),
            "commodity": COMMODITY,
            "district": DISTRICT,
            "state": STATE,
            "unit": "INR/quintal",
            "horizonWeeks": max(HORIZONS),
            "model": model_label,
            "features": {
                "weather": has_weather,
                "arrivals": bool(daily["arrivals_tonnes"].notna().any()),
            },
        },
        "markets": sorted(weekly["market"].unique().tolist()),
        "varieties": sorted(weekly["variety"].unique().tolist()),
        "series": series,
        "backtest": backtest,
    }


def write_json(payload: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(text + "\n", encoding="utf-8")


def forecast_frame(pred: pd.DataFrame) -> pd.DataFrame:
    return pred[["series_id", "week", "h", *QCOLS]]
