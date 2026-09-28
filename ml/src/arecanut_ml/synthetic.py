"""Synthetic demo data, used only until real Agmarknet history has been ingested.

The generator is calibrated to published facts about Dakshina Kannada arecanut, not to any real
price series:

* Coca trades at roughly 0.6x chali, so Coca in Bantwala sits near Rs 20-22k/qtl while New Variety
  in Mangaluru sits near Rs 35-37k/qtl, matching the spread reported in recent mandi bulletins.
* Prices peak around February and dip in spring when harvest arrivals rise.
* Excess monsoon rain slightly lifts prices a few weeks later, when drying is disrupted.

Everything the pipeline exports from this data is labelled ``dataSource = "synthetic"``.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import MARKETS, VARIETIES

START = pd.Timestamp("2016-01-04")  # a Monday
# Simulate far past any realistic "as of" date so earlier history never changes as time moves on.
SIM_END = pd.Timestamp("2032-12-27")

MARKET_PREMIUM = {
    "Mangalore": 0.02,
    "Bantwala": -0.01,
    "Puttur": 0.01,
    "Sullia": 0.0,
    "Belthangady": -0.015,
}
VARIETY_LEVEL = {"New Variety": 0.0, "Old Variety": np.log(1.12), "Coca": np.log(0.62)}
VARIETY_SEASON_AMP = {"New Variety": 1.0, "Old Variety": 0.8, "Coca": 1.3}
VARIETY_NOISE = {"New Variety": 0.012, "Old Variety": 0.010, "Coca": 0.020}
# Share of trading days on which a market reports a price for each variety.
REPORT_RATE = {
    "Mangalore": 0.8,
    "Bantwala": 0.6,
    "Puttur": 0.7,
    "Sullia": 0.55,
    "Belthangady": 0.5,
}


def seasonal_log_index(week_of_year: np.ndarray) -> np.ndarray:
    """Peak in mid-February, dips in May and November, recovery through the monsoon."""
    w = week_of_year.astype(float)
    return 0.03 * np.cos(2 * np.pi * (w - 7) / 52) + 0.035 * np.cos(4 * np.pi * (w - 7) / 52)


def rain_climatology(week_of_year: np.ndarray) -> np.ndarray:
    """Weekly rainfall (mm) for coastal Karnataka: SW monsoon Jun-Sep, a smaller NE burst in Oct."""
    w = week_of_year.astype(float)
    sw = 230 * np.exp(-0.5 * ((w - 28) / 5.5) ** 2)
    ne = 35 * np.exp(-0.5 * ((w - 42) / 3.0) ** 2)
    return 3 + sw + ne


def arrivals_climatology(week_of_year: np.ndarray) -> np.ndarray:
    """Relative arrivals: dried nuts reach the mandis from March to May."""
    w = week_of_year.astype(float)
    return np.exp(0.5 * np.cos(2 * np.pi * (w - 16) / 52))


def _weekly_latent(rng: np.random.Generator, weeks: pd.DatetimeIndex) -> pd.DataFrame:
    n = len(weeks)
    woy = weeks.isocalendar().week.to_numpy().astype(int)
    years = (weeks - START).days.to_numpy() / 365.25

    # Rain: yearly monsoon strength times weekly gamma noise.
    year_idx = weeks.year.to_numpy() - weeks.year.min()
    year_strength = rng.lognormal(0.0, 0.2, size=year_idx.max() + 1)[year_idx]
    rain = rain_climatology(woy) * year_strength * rng.gamma(4.0, 0.25, size=n)

    rain_s = pd.Series(rain)
    rain_8 = rain_s.rolling(8, min_periods=1).sum()
    clim_8 = pd.Series(rain_climatology(woy)).rolling(8, min_periods=1).sum()
    rain_anom = np.log((rain_8 + 20) / (clim_8 + 20)).shift(4).fillna(0).to_numpy()

    arrivals_rel = arrivals_climatology(woy) * rng.lognormal(0.0, 0.15, size=n)
    arr_anom = np.log(arrivals_rel / arrivals_climatology(woy))

    # Mean-reverting deviation around a slow uptrend plus a ~4.5-year cycle.
    trend = np.log(24_000) + 0.035 * years + 0.07 * np.sin(2 * np.pi * years / 4.5)
    x = np.zeros(n)
    for i in range(1, n):
        jump = rng.normal(0, 0.06) if rng.random() < 0.01 else 0.0
        x[i] = 0.985 * x[i - 1] + rng.normal(0, 0.016) + jump

    base = trend + x + 0.025 * rain_anom - 0.03 * np.roll(arr_anom, 1)
    return pd.DataFrame(
        {
            "week": weeks,
            "woy": woy,
            "base": base,
            "rain_mm": rain,
            "arrivals_rel": arrivals_rel,
        }
    )


def generate(as_of: pd.Timestamp | str, seed: int = 2410) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return ``(prices_daily, weather_daily)`` for every day before ``as_of``.

    ``prices_daily`` has the normalised schema produced by :mod:`arecanut_ml.ingest`.
    """
    as_of = pd.Timestamp(as_of).normalize()
    rng = np.random.default_rng(seed)
    weeks = pd.date_range(START, SIM_END, freq="W-MON")
    latent = _weekly_latent(rng, weeks)
    season = seasonal_log_index(latent["woy"].to_numpy())

    frames: list[pd.DataFrame] = []
    for market in MARKETS:
        for variety in VARIETIES:
            n = len(weeks)
            idio = np.zeros(n)
            for i in range(1, n):
                idio[i] = 0.8 * idio[i - 1] + rng.normal(0, VARIETY_NOISE[variety])
            log_weekly = (
                latent["base"].to_numpy()
                + VARIETY_SEASON_AMP[variety] * season
                + MARKET_PREMIUM[market]
                + VARIETY_LEVEL[variety]
                + idio
            )
            # Expand to Mon-Sat trading days, keeping a random subset as reported days.
            days = weeks.repeat(6) + pd.to_timedelta(np.tile(np.arange(6), n), unit="D")
            weekly_price = np.exp(np.repeat(log_weekly, 6))
            reported = rng.random(len(days)) < REPORT_RATE[market]
            modal = weekly_price * np.exp(rng.normal(0, 0.008, size=len(days)))
            min_p = modal * rng.uniform(0.82, 0.95, size=len(days))
            max_p = modal * rng.uniform(1.02, 1.08, size=len(days))
            arrivals = (
                np.repeat(latent["arrivals_rel"].to_numpy(), 6)
                * {"New Variety": 40, "Old Variety": 15, "Coca": 8}[variety]
                * (2.0 if market == "Mangalore" else 1.0)
                * rng.lognormal(0, 0.3, size=len(days))
            )
            frames.append(
                pd.DataFrame(
                    {
                        "date": days[reported],
                        "market": market,
                        "variety": variety,
                        "min_price": np.round(min_p[reported], -2),
                        "max_price": np.round(max_p[reported], -2),
                        "modal_price": np.round(modal[reported], -1),
                        "arrivals_tonnes": np.round(arrivals[reported], 1),
                    }
                )
            )

    prices = pd.concat(frames, ignore_index=True)
    prices = prices[prices["date"] < as_of].sort_values(["date", "market", "variety"])

    daily_rain = (
        np.repeat(latent["rain_mm"].to_numpy(), 7)
        * rng.dirichlet(np.ones(7), size=len(weeks)).ravel()
    )
    weather = pd.DataFrame(
        {
            "date": weeks.repeat(7) + pd.to_timedelta(np.tile(np.arange(7), len(weeks)), unit="D"),
            "precip_mm": np.round(daily_rain, 1),
        }
    )
    weather = weather[weather["date"] < as_of]
    return prices.reset_index(drop=True), weather.reset_index(drop=True)
