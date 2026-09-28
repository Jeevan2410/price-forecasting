"""Feature engineering for direct multi-horizon forecasting.

One row per (series, origin week ``t``, horizon ``h``). Every feature uses only data up to and
including week ``t``; the target is the log return ``log P[t+h] - log P[t]``.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import HORIZONS

RETURN_LAGS = (1, 2, 4, 8, 13, 26, 52)

BASE_FEATURES = [
    *[f"ret_{k}" for k in RETURN_LAGS],
    "vol_8",
    "vol_26",
    "dev_13",
    "dev_52",
    "spread",
    "arr_4",
    "arr_yoy",
    "rain_4",
    "rain_13",
    "rain_anom_13",
    "market_code",
    "variety_code",
]
HORIZON_FEATURES = ["h", "seas_ret_1y", "seas_ret_2y", "seas_ret", "woy_sin", "woy_cos"]
FEATURE_COLUMNS = BASE_FEATURES + HORIZON_FEATURES
CATEGORICAL_FEATURES = ["market_code", "variety_code"]


def _series_frame(g: pd.DataFrame, rain: pd.Series) -> pd.DataFrame:
    g = g.sort_values("week").reset_index(drop=True)
    lp = np.log(g["price"])
    out = pd.DataFrame({"series_id": g["series_id"], "week": g["week"], "lp": lp})
    for k in RETURN_LAGS:
        out[f"ret_{k}"] = lp - lp.shift(k)
    r1 = lp.diff()
    out["vol_8"] = r1.rolling(8, min_periods=4).std()
    out["vol_26"] = r1.rolling(26, min_periods=13).std()
    out["dev_13"] = lp - lp.rolling(13, min_periods=8).mean()
    out["dev_52"] = lp - lp.rolling(52, min_periods=26).mean()
    out["spread"] = np.log(g["max_price"] / g["min_price"])

    arrivals = g["arrivals_tonnes"].astype(float)
    arr_4 = np.log1p(arrivals.rolling(4, min_periods=2).sum())
    out["arr_4"] = arr_4
    out["arr_yoy"] = arr_4 - arr_4.shift(52)

    r = rain.reindex(g["week"]).to_numpy(dtype=float)
    r = pd.Series(r)
    rain_13 = r.rolling(13, min_periods=10).sum()
    clim_13 = pd.concat([rain_13.shift(52), rain_13.shift(104)], axis=1).mean(axis=1)
    out["rain_4"] = r.rolling(4, min_periods=3).sum()
    out["rain_13"] = rain_13
    out["rain_anom_13"] = np.log((rain_13 + 20) / (clim_13 + 20))

    for h in HORIZONS:
        out[f"_y_{h}"] = lp.shift(-h) - lp
        out[f"_s1_{h}"] = lp.shift(52 - h) - lp.shift(52)
        out[f"_s2_{h}"] = lp.shift(104 - h) - lp.shift(104)
    return out


def build_features(
    weekly: pd.DataFrame,
    rain_weekly: pd.DataFrame | None = None,
    horizons: tuple[int, ...] = HORIZONS,
) -> pd.DataFrame:
    """Return the long feature table with columns ``series_id, week, h, lp, y`` + features.

    Rows whose origin price is unknown are dropped. ``y`` is NaN when ``t + h`` is in the future.
    """
    if rain_weekly is not None and not rain_weekly.empty:
        rain = rain_weekly.set_index("week")["rain_mm"].astype(float)
    else:
        rain = pd.Series(dtype=float)

    markets = sorted(weekly["market"].unique())
    varieties = sorted(weekly["variety"].unique())
    meta = weekly.drop_duplicates("series_id").set_index("series_id")[["market", "variety"]]

    per_series = [_series_frame(g, rain) for _, g in weekly.groupby("series_id", sort=True)]
    wide = pd.concat(per_series, ignore_index=True)
    wide = wide[wide["lp"].notna()]
    wide["market_code"] = wide["series_id"].map(meta["market"]).map(markets.index)
    wide["variety_code"] = wide["series_id"].map(meta["variety"]).map(varieties.index)

    base_cols = ["series_id", "week", "lp", *BASE_FEATURES]
    long_parts = []
    for h in horizons:
        part = wide[base_cols].copy()
        part["h"] = h
        s1 = wide[f"_s1_{h}"]
        s2 = wide[f"_s2_{h}"]
        part["seas_ret_1y"] = s1
        part["seas_ret_2y"] = s2
        part["seas_ret"] = pd.concat([s1, s2], axis=1).mean(axis=1)
        target_woy = (wide["week"] + pd.to_timedelta(7 * h, unit="D")).dt.isocalendar().week
        angle = 2 * np.pi * target_woy.astype(float) / 52.0
        part["woy_sin"] = np.sin(angle)
        part["woy_cos"] = np.cos(angle)
        part["y"] = wide[f"_y_{h}"]
        long_parts.append(part)

    feats = pd.concat(long_parts, ignore_index=True)
    feats["target_week"] = feats["week"] + pd.to_timedelta(7 * feats["h"], unit="D")
    return feats.sort_values(["series_id", "week", "h"]).reset_index(drop=True)
