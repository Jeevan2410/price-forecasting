from __future__ import annotations

import pandas as pd
import pytest

from arecanut_ml import synthetic
from arecanut_ml.features import build_features
from arecanut_ml.weekly import to_weekly, weather_weekly

AS_OF = "2026-09-28"


@pytest.fixture(scope="session")
def synthetic_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    return synthetic.generate(AS_OF)


@pytest.fixture(scope="session")
def small_prices(synthetic_data) -> pd.DataFrame:
    """Two markets x two varieties: enough structure for the models, fast to fit."""
    prices, _ = synthetic_data
    keep = prices["market"].isin(["Mangalore", "Puttur"]) & prices["variety"].isin(
        ["New Variety", "Coca"]
    )
    return prices[keep].reset_index(drop=True)


@pytest.fixture(scope="session")
def small_weekly(small_prices) -> pd.DataFrame:
    return to_weekly(small_prices)


@pytest.fixture(scope="session")
def small_rain(synthetic_data) -> pd.DataFrame:
    return weather_weekly(synthetic_data[1])


@pytest.fixture(scope="session")
def small_feats(small_weekly, small_rain) -> pd.DataFrame:
    return build_features(small_weekly, small_rain)
