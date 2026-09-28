from __future__ import annotations

import json
import math

import pandas as pd
import pytest

from arecanut_ml import ingest, synthetic
from arecanut_ml.pipeline import load_inputs, run

from .conftest import AS_OF


def test_synthetic_is_deterministic_and_history_is_stable():
    a, _ = synthetic.generate("2025-06-01")
    b, _ = synthetic.generate("2025-06-01")
    later, _ = synthetic.generate("2026-01-01")
    pd.testing.assert_frame_equal(a, b)
    # Moving "as of" forward only appends data; the past never changes.
    prefix = later[later["date"] < pd.Timestamp("2025-06-01")].reset_index(drop=True)
    pd.testing.assert_frame_equal(a, prefix)
    assert a["date"].max() < pd.Timestamp("2025-06-01")


def test_synthetic_matches_published_price_ranges(synthetic_data):
    prices, weather = synthetic_data
    recent = prices[prices["date"] >= pd.Timestamp("2026-06-01")]
    median = recent.groupby("variety")["modal_price"].median()
    assert 30_000 < median["New Variety"] < 40_000
    assert 17_000 < median["Coca"] < 25_000
    assert median["Old Variety"] > median["New Variety"] > median["Coca"]
    # Monsoon: July is far wetter than February.
    month = weather["date"].dt.month
    assert weather[month == 7]["precip_mm"].sum() > 10 * weather[month == 2]["precip_mm"].sum()


def test_load_inputs_falls_back_to_synthetic_without_real_history(tmp_path, small_prices):
    short = small_prices[small_prices["date"] >= pd.Timestamp("2026-01-01")]
    csv = tmp_path / "prices.csv"
    ingest.write_prices_csv(short, csv)
    inputs = load_inputs("auto", pd.Timestamp(AS_OF), csv, tmp_path / "none.csv")
    assert inputs.source == "synthetic"

    with pytest.raises(SystemExit):
        load_inputs("real", pd.Timestamp(AS_OF), tmp_path / "missing.csv", tmp_path / "none.csv")


@pytest.fixture(scope="module")
def payload(tmp_path_factory, small_prices) -> dict:
    tmp = tmp_path_factory.mktemp("pipeline")
    csv = tmp / "prices.csv"
    ingest.write_prices_csv(small_prices, csv)
    out = tmp / "dashboard.json"
    run(
        mode="auto",
        out=out,
        as_of=AS_OF,
        backtest=True,
        backtest_weeks=16,
        prices_csv=csv,
        weather_csv=tmp / "no-weather.csv",
    )
    return json.loads(out.read_text())


def test_pipeline_uses_real_csv_when_history_is_long_enough(payload):
    meta = payload["meta"]
    assert meta["dataSource"] == "agmarknet"
    assert meta["features"]["weather"] is False
    assert meta["lastWeek"] == "2026-09-21"
    assert len(payload["series"]) == 4


def test_exported_series_contract(payload):
    for s in payload["series"]:
        assert s["id"] == f"{s['market'].lower()}--{s['variety'].lower().replace(' ', '-')}"
        assert len(s["history"]) > 200
        weeks = [h["week"] for h in s["history"]]
        assert weeks == sorted(weeks)
        assert len(s["forecast"]) == 12
        assert s["forecast"][0]["week"] > payload["meta"]["lastWeek"]
        for f in s["forecast"]:
            assert f["p10"] <= f["p50"] <= f["p90"]
        assert len(s["seasonality"]) == 12
        mean_index = sum(m["index"] for m in s["seasonality"]) / 12
        assert math.isclose(mean_index, 1.0, abs_tol=1e-3)
        assert s["latest"]["price"] == s["history"][-1]["price"]


def test_exported_backtest_block(payload):
    bt = payload["backtest"]
    assert bt["origins"] >= 3
    assert {m["name"] for m in bt["models"]} == {"naive", "seasonal_naive", "arima", "gbm"}
    assert set(bt["conformalMargins"]) == {str(h) for h in range(1, 13)}
