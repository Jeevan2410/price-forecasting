from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from arecanut_ml.backtest import (
    _conformal_margin,
    conformal_margins,
    rolling_origins,
    run_backtest,
    summarize,
    train_rows,
)
from arecanut_ml.models import (
    QCOLS,
    ArimaModel,
    GradientBoostingModel,
    NaiveModel,
    SeasonalNaiveModel,
)


@pytest.fixture(scope="module")
def origin(small_feats) -> pd.Timestamp:
    return small_feats["week"].max() - pd.Timedelta(weeks=26)


def test_train_rows_only_contain_known_outcomes(small_feats, origin):
    train = train_rows(small_feats, origin)
    assert (train["target_week"] <= origin).all()
    assert train["y"].notna().all()


def test_gbm_quantiles_are_ordered_and_sensible(small_feats, small_weekly, origin):
    model = GradientBoostingModel(max_iter=60)
    model.fit(train_rows(small_feats, origin))
    rows = small_feats[small_feats["week"] == origin]
    pred = model.predict(rows, small_weekly)

    assert len(pred) == len(rows)
    assert (pred["q10"] <= pred["q50"]).all() and (pred["q50"] <= pred["q90"]).all()
    # 12-week log returns for this crop stay well inside +/-40%.
    assert pred[QCOLS].abs().max().max() < 0.4
    # Uncertainty should grow with the horizon.
    width = (pred["q90"] - pred["q10"]).groupby(pred["h"]).mean()
    assert width.loc[12] > width.loc[1]


def test_gbm_predict_before_fit_raises(small_feats):
    with pytest.raises(RuntimeError):
        GradientBoostingModel().predict(small_feats.head(3), small_feats)


def test_baselines(small_feats, small_weekly, origin):
    rows = small_feats[small_feats["week"] == origin]
    hist = small_weekly[small_weekly["week"] <= origin]

    naive = NaiveModel().predict(rows, hist)
    assert (naive[QCOLS] == 0).all().all()

    seasonal = SeasonalNaiveModel().predict(rows, hist)
    np.testing.assert_allclose(seasonal["q50"], rows["seas_ret"].fillna(0))

    arima = ArimaModel().predict(rows, hist)
    assert arima["q50"].abs().gt(0).any(), "ARIMA must produce real forecasts, not a fallback"
    assert arima["q50"].abs().max() < 0.3


def test_conformal_margin_hits_target_quantile():
    scores = np.arange(1, 101, dtype=float)  # 1..100
    # ceil(101 * 0.8) / 100 = 0.81 -> the 81st smallest score.
    assert _conformal_margin(scores, alpha=0.2) == 81
    assert _conformal_margin(np.array([]), alpha=0.2) == 0.0


def test_backtest_end_to_end(small_feats, small_weekly):
    models = [NaiveModel(), SeasonalNaiveModel(), GradientBoostingModel(max_iter=60)]
    origins = rolling_origins(small_feats, lookback_weeks=24, step_weeks=8)
    assert len(origins) == 3
    assert all(np.diff([o.value for o in origins]) == pd.Timedelta(weeks=8).value)

    results = run_backtest(small_feats, small_weekly, models, origins)
    assert set(results["model"]) == {"naive", "seasonal_naive", "gbm"}
    assert results["y"].notna().all()

    summary = summarize(results, models)
    assert summary["origins"] == 3
    assert summary["champion"] in {"naive", "seasonal_naive", "gbm"}
    by_name = {m["name"]: m for m in summary["models"]}
    assert by_name["naive"]["byHorizon"][0]["directionalAccuracy"] is None
    assert by_name["naive"]["byHorizon"][0]["coverage80"] is None
    gbm_h = by_name["gbm"]["byHorizon"]
    assert all(0 <= x["coverage80"] <= 100 for x in gbm_h)
    assert all(x["mape"] > 0 for x in gbm_h)

    margins = conformal_margins(results)
    assert set(margins) == set(range(1, 13))
