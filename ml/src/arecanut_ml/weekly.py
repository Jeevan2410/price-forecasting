"""Daily mandi rows to a regular weekly panel."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import series_id

# Short gaps (a holiday week, a missed upload) are bridged; longer gaps stay missing.
MAX_FFILL_WEEKS = 3


def week_start(dates: pd.Series) -> pd.Series:
    """Monday of the ISO week containing each date."""
    d = pd.to_datetime(dates).dt.normalize()
    return d - pd.to_timedelta(d.dt.weekday, unit="D")


def to_weekly(prices: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily rows to one row per (series, week) on a gap-free weekly grid.

    ``price`` is the median modal price of the week. It is forward-filled over at most
    :data:`MAX_FFILL_WEEKS` missing weeks, and ``observed`` records which weeks had real rows.
    """
    df = prices.copy()
    df["week"] = week_start(df["date"])
    agg = (
        df.groupby(["market", "variety", "week"], as_index=False)
        .agg(
            price=("modal_price", "median"),
            min_price=("min_price", "median"),
            max_price=("max_price", "median"),
            arrivals_tonnes=("arrivals_tonnes", lambda s: s.sum(min_count=1)),
            n_obs=("modal_price", "size"),
        )
        .sort_values(["market", "variety", "week"])
    )
    last_week = agg["week"].max()

    frames: list[pd.DataFrame] = []
    for (market, variety), grp in agg.groupby(["market", "variety"], sort=True):
        grid = pd.date_range(grp["week"].min(), last_week, freq="W-MON")
        g = grp.set_index("week").reindex(grid)
        g.index.name = "week"
        g["observed"] = g["n_obs"].notna()
        g["n_obs"] = g["n_obs"].fillna(0).astype(int)
        for col in ("price", "min_price", "max_price"):
            g[col] = g[col].ffill(limit=MAX_FFILL_WEEKS)
        g["market"] = market
        g["variety"] = variety
        g["series_id"] = series_id(market, variety)
        frames.append(g.reset_index())

    weekly = pd.concat(frames, ignore_index=True)
    return weekly[
        [
            "series_id",
            "market",
            "variety",
            "week",
            "price",
            "min_price",
            "max_price",
            "arrivals_tonnes",
            "n_obs",
            "observed",
        ]
    ]


def weather_weekly(weather: pd.DataFrame | None) -> pd.DataFrame:
    """Weekly rainfall totals (mm). Weeks with fewer than 5 days of data are left missing."""
    if weather is None or weather.empty:
        return pd.DataFrame(columns=["week", "rain_mm"])
    df = weather.copy()
    df["week"] = week_start(df["date"])
    out = df.groupby("week").agg(rain_mm=("precip_mm", "sum"), days=("precip_mm", "count"))
    out.loc[out["days"] < 5, "rain_mm"] = np.nan
    return out[["rain_mm"]].reset_index()


def history_weeks(weekly: pd.DataFrame) -> pd.Series:
    """Number of observed weeks per series."""
    return weekly[weekly["observed"]].groupby("series_id").size()
