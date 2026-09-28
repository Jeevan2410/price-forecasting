"""Forecasting models.

Each model predicts the log return ``log P[t+h] - log P[t]`` at the P10/P50/P90 quantiles.
``fit(train)`` receives rows whose target week is known at the forecast origin;
``predict(rows, weekly)`` receives the origin rows plus the weekly panel (for per-series models).
"""

from __future__ import annotations

import logging
import warnings
from typing import Protocol

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from .config import QUANTILES
from .features import CATEGORICAL_FEATURES, FEATURE_COLUMNS

QCOLS = [f"q{int(q * 100)}" for q in QUANTILES]  # ["q10", "q50", "q90"]

log = logging.getLogger(__name__)


class Forecaster(Protocol):
    name: str
    label: str

    def fit(self, train: pd.DataFrame) -> None: ...

    def predict(self, rows: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame: ...


def _point(rows: pd.DataFrame, values: np.ndarray) -> pd.DataFrame:
    out = rows[["series_id", "week", "h"]].copy()
    for col in QCOLS:
        out[col] = values
    return out


class NaiveModel:
    """Tomorrow's price is today's price."""

    name = "naive"
    label = "Naive (last price)"

    def fit(self, train: pd.DataFrame) -> None:
        return None

    def predict(self, rows: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame:
        return _point(rows, np.zeros(len(rows)))


class SeasonalNaiveModel:
    """Repeat the average move seen over the same calendar window in the last two years."""

    name = "seasonal_naive"
    label = "Seasonal naive"

    def fit(self, train: pd.DataFrame) -> None:
        return None

    def predict(self, rows: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame:
        return _point(rows, rows["seas_ret"].fillna(0.0).to_numpy())


class ArimaModel:
    """ARIMA(1,1,1) on log weekly price per series (the classical approach from the literature)."""

    name = "arima"
    label = "ARIMA(1,1,1)"

    def __init__(self, window: int = 260):
        self.window = window

    def fit(self, train: pd.DataFrame) -> None:
        return None

    def predict(self, rows: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame:
        from statsmodels.tsa.arima.model import ARIMA

        max_h = int(rows["h"].max())  # statsmodels rejects numpy integer horizons
        preds: dict[tuple[str, pd.Timestamp], np.ndarray] = {}
        for (sid, origin), _ in rows.groupby(["series_id", "week"]):
            hist = weekly[(weekly["series_id"] == sid) & (weekly["week"] <= origin)]
            y = np.log(hist["price"].ffill().dropna().to_numpy()[-self.window :])
            path = np.zeros(max_h)
            if len(y) >= 30:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        res = ARIMA(y, order=(1, 1, 1)).fit()
                        path = res.forecast(max_h) - y[-1]
                except (ValueError, np.linalg.LinAlgError) as exc:
                    log.warning("ARIMA failed for %s at %s: %s", sid, origin.date(), exc)
            preds[(sid, origin)] = path
        values = np.array(
            [
                preds[(s, w)][h - 1]
                for s, w, h in zip(rows["series_id"], rows["week"], rows["h"], strict=True)
            ]
        )
        return _point(rows, values)


class GradientBoostingModel:
    """Pooled gradient-boosted trees with quantile loss (one model per quantile)."""

    name = "gbm"
    label = "Gradient boosting (quantile)"

    def __init__(self, max_iter: int = 250, learning_rate: float = 0.05, seed: int = 7):
        self.params = dict(
            max_iter=max_iter,
            learning_rate=learning_rate,
            max_leaf_nodes=31,
            min_samples_leaf=40,
            l2_regularization=1.0,
            random_state=seed,
        )
        self.models: dict[str, HistGradientBoostingRegressor] = {}
        self.columns: list[str] = []

    def fit(self, train: pd.DataFrame) -> None:
        train = train[train["y"].notna()]
        # Optional sources (weather, arrivals) may be entirely absent; trees cannot bin them.
        self.columns = [c for c in FEATURE_COLUMNS if train[c].notna().any()]
        X = train[self.columns]
        cat_mask = [c in CATEGORICAL_FEATURES for c in self.columns]
        for q, col in zip(QUANTILES, QCOLS, strict=True):
            model = HistGradientBoostingRegressor(
                loss="quantile", quantile=q, categorical_features=cat_mask, **self.params
            )
            model.fit(X, train["y"])
            self.models[col] = model

    def predict(self, rows: pd.DataFrame, weekly: pd.DataFrame) -> pd.DataFrame:
        if not self.models:
            raise RuntimeError("fit() must be called before predict()")
        out = rows[["series_id", "week", "h"]].copy()
        X = rows[self.columns]
        raw = np.column_stack([self.models[c].predict(X) for c in QCOLS])
        raw.sort(axis=1)  # quantile regressors are fit independently; prevent crossing
        for i, col in enumerate(QCOLS):
            out[col] = raw[:, i]
        return out


def all_models() -> list[Forecaster]:
    return [NaiveModel(), SeasonalNaiveModel(), ArimaModel(), GradientBoostingModel()]
