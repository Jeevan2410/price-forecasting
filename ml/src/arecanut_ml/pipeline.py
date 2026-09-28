"""End-to-end run: load data, backtest, fit the final model, export JSON."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import pandas as pd

from . import synthetic
from .backtest import conformal_margins, rolling_origins, run_backtest, summarize
from .config import DASHBOARD_JSON, MIN_WEEKS_FOR_REAL, RAW_PRICES_CSV, RAW_WEATHER_CSV
from .export import build_dashboard, forecast_frame, write_json
from .features import build_features
from .ingest import read_prices_csv, read_weather_csv
from .models import GradientBoostingModel, all_models
from .weekly import history_weeks, to_weekly, weather_weekly

log = logging.getLogger(__name__)

Mode = Literal["auto", "synthetic", "real"]


@dataclass
class Inputs:
    prices: pd.DataFrame
    weather: pd.DataFrame | None
    source: Literal["synthetic", "agmarknet"]


def load_inputs(
    mode: Mode,
    as_of: pd.Timestamp,
    prices_csv: Path = RAW_PRICES_CSV,
    weather_csv: Path = RAW_WEATHER_CSV,
) -> Inputs:
    real = read_prices_csv(prices_csv) if mode != "synthetic" else None
    if real is not None and not real.empty:
        weeks = history_weeks(to_weekly(real))
        enough = bool((weeks >= MIN_WEEKS_FOR_REAL).any())
        if enough or mode == "real":
            log.info("using real Agmarknet data (%d rows)", len(real))
            return Inputs(real, read_weather_csv(weather_csv), "agmarknet")
        log.warning(
            "real data has at most %d weeks of history (< %d); falling back to synthetic",
            int(weeks.max()),
            MIN_WEEKS_FOR_REAL,
        )
    if mode == "real":
        raise SystemExit(f"--mode real but no usable price data at {prices_csv}")
    prices, weather = synthetic.generate(as_of)
    return Inputs(prices, weather, "synthetic")


def run(
    mode: Mode = "auto",
    out: Path = DASHBOARD_JSON,
    as_of: str | None = None,
    backtest: bool = True,
    backtest_weeks: int = 104,
    prices_csv: Path = RAW_PRICES_CSV,
    weather_csv: Path = RAW_WEATHER_CSV,
) -> dict:
    as_of_ts = (
        pd.Timestamp(as_of) if as_of else pd.Timestamp.now(tz="Asia/Kolkata").tz_localize(None)
    )
    as_of_ts = as_of_ts.normalize()
    inputs = load_inputs(mode, as_of_ts, prices_csv, weather_csv)

    weekly = to_weekly(inputs.prices)
    rain = weather_weekly(inputs.weather)
    feats = build_features(weekly, rain)
    log.info("feature table: %d rows, %d series", len(feats), feats["series_id"].nunique())

    summary: dict = {"models": [], "origins": 0, "champion": None}
    margins: dict[int, float] = {}
    if backtest:
        models = all_models()
        origins = rolling_origins(feats, lookback_weeks=backtest_weeks)
        results = run_backtest(feats, weekly, models, origins)
        summary = summarize(results, models)
        margins = conformal_margins(results)
        summary["conformalMargins"] = {str(h): round(m, 5) for h, m in margins.items()}
        log.info("backtest champion: %s", summary.get("champion"))

    final = GradientBoostingModel()
    final.fit(feats[feats["y"].notna()])
    last_week = weekly["week"].max()
    origin_rows = feats[feats["week"] == last_week]
    pred = forecast_frame(final.predict(origin_rows, weekly))
    widen = pred["h"].map(margins).fillna(0.0)
    pred = pred.assign(q10=pred["q10"] - widen, q90=pred["q90"] + widen)
    # A negative margin (over-wide band) must never push q10/q90 past the median.
    pred = pred.assign(q10=pred[["q10", "q50"]].min(axis=1), q90=pred[["q90", "q50"]].max(axis=1))

    payload = build_dashboard(
        daily=inputs.prices,
        weekly=weekly,
        forecast=pred,
        backtest=summary,
        data_source=inputs.source,
        as_of=as_of_ts,
        has_weather=not rain.empty,
        model_label=final.label,
    )
    write_json(payload, out)
    log.info("wrote %s (%d series)", out, len(payload["series"]))
    return payload
