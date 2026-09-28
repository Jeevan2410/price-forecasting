"""Rolling-origin backtest: refit every model at each origin using only data known then."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import numpy as np
import pandas as pd

from .config import HORIZONS
from .models import QCOLS, Forecaster

log = logging.getLogger(__name__)

# Moves smaller than this are treated as "flat" and excluded from directional accuracy.
FLAT_THRESHOLD = 0.005
# Target miscoverage of the P10–P90 band.
ALPHA = 0.2


def rolling_origins(
    feats: pd.DataFrame, lookback_weeks: int = 104, step_weeks: int = 4
) -> list[pd.Timestamp]:
    last = feats["week"].max()
    first = last - pd.Timedelta(weeks=lookback_weeks)
    origins = pd.date_range(first, last - pd.Timedelta(weeks=1), freq=f"{step_weeks}W-MON")
    return [pd.Timestamp(o) for o in origins if o >= feats["week"].min() + pd.Timedelta(weeks=104)]


def train_rows(feats: pd.DataFrame, origin: pd.Timestamp) -> pd.DataFrame:
    """Rows whose outcome was already observed at ``origin`` — the only legal training data."""
    return feats[(feats["target_week"] <= origin) & feats["y"].notna()]


def run_backtest(
    feats: pd.DataFrame,
    weekly: pd.DataFrame,
    models: Sequence[Forecaster],
    origins: Sequence[pd.Timestamp],
) -> pd.DataFrame:
    """Return one row per (model, series, origin, h) with the actual and predicted log returns."""
    results = []
    for i, origin in enumerate(origins):
        train = train_rows(feats, origin)
        test = feats[(feats["week"] == origin) & feats["y"].notna()]
        if test.empty or train.empty:
            continue
        hist = weekly[weekly["week"] <= origin]
        for model in models:
            model.fit(train)
            pred = model.predict(test, hist)
            merged = test[["series_id", "week", "h", "y"]].merge(
                pred, on=["series_id", "week", "h"], how="inner"
            )
            merged["model"] = model.name
            results.append(merged)
        log.info("backtest origin %d/%d (%s) done", i + 1, len(origins), origin.date())
    if not results:
        return pd.DataFrame(columns=["model", "series_id", "week", "h", "y", *QCOLS])
    return pd.concat(results, ignore_index=True)


def _conformal_margin(scores: np.ndarray, alpha: float = ALPHA) -> float:
    """Split-conformal quantile of nonconformity scores (finite-sample corrected)."""
    n = len(scores)
    if n == 0:
        return 0.0
    k = int(np.ceil((n + 1) * (1 - alpha)))  # the k-th smallest score
    return float(np.sort(scores)[min(k, n) - 1])


def conformal_margins(results: pd.DataFrame, model: str = "gbm") -> dict[int, float]:
    """Per-horizon widening of [q10, q90] so that ~80% of backtest outcomes fall inside.

    Conformalised quantile regression (Romano et al., 2019): the score is how far the outcome fell
    outside the raw band (negative when inside), and the band is widened by its 80th percentile.
    """
    m = results[results["model"] == model]
    scores = np.maximum(m["q10"] - m["y"], m["y"] - m["q90"])
    return {
        int(h): _conformal_margin(scores[m["h"] == h].to_numpy()) for h in sorted(m["h"].unique())
    }


def _loo_calibrated_coverage(m: pd.DataFrame) -> float:
    """Coverage after conformal widening, calibrating each origin on the *other* origins only."""
    scores = np.maximum(m["q10"] - m["y"], m["y"] - m["q90"])
    hits = []
    for origin in m["week"].unique():
        held_out = m["week"] == origin
        margin = _conformal_margin(scores[~held_out].to_numpy())
        hits.append((scores[held_out] <= margin).to_numpy())
    return float(np.concatenate(hits).mean()) if hits else float("nan")


def summarize(results: pd.DataFrame, models: Sequence[Forecaster]) -> dict:
    """Per-model, per-horizon MAPE, directional accuracy and P10–P90 coverage."""
    if results.empty:
        return {"models": [], "origins": 0, "champion": None}
    df = results.copy()
    df["ape"] = np.abs(np.exp(df["q50"]) - np.exp(df["y"])) / np.exp(df["y"])
    moving = df["y"].abs() >= FLAT_THRESHOLD
    df["dir_hit"] = np.where(moving, np.sign(df["q50"]) == np.sign(df["y"]), np.nan)
    df["covered"] = (df["y"] >= df["q10"]) & (df["y"] <= df["q90"])
    has_interval = (df["q90"] - df["q10"]) > 1e-9

    out_models = []
    for model in models:
        m = df[df["model"] == model.name]
        if m.empty:
            continue
        interval = bool(has_interval[m.index].any())
        directional = model.name != "naive"
        by_h = []
        for h in HORIZONS:
            mh = m[m["h"] == h]
            if mh.empty:
                continue
            by_h.append(
                {
                    "h": int(h),
                    "mape": round(float(mh["ape"].mean()) * 100, 2),
                    "directionalAccuracy": round(float(np.nanmean(mh["dir_hit"])) * 100, 1)
                    if directional and mh["dir_hit"].notna().any()
                    else None,
                    "coverage80": round(_loo_calibrated_coverage(mh) * 100, 1)
                    if interval
                    else None,
                    "coverage80Raw": round(float(mh["covered"].mean()) * 100, 1)
                    if interval
                    else None,
                    "n": int(len(mh)),
                }
            )
        out_models.append(
            {
                "name": model.name,
                "label": model.label,
                "mapeAvg": round(float(m["ape"].mean()) * 100, 2),
                "byHorizon": by_h,
            }
        )
    champion = min(out_models, key=lambda x: x["mapeAvg"])["name"] if out_models else None
    origins = sorted(df["week"].unique())
    return {
        "origins": len(origins),
        "from": pd.Timestamp(origins[0]).strftime("%Y-%m-%d"),
        "to": pd.Timestamp(origins[-1]).strftime("%Y-%m-%d"),
        "series": int(df["series_id"].nunique()),
        "champion": champion,
        "models": out_models,
    }
