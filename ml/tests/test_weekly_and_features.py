from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from arecanut_ml.features import FEATURE_COLUMNS, build_features
from arecanut_ml.weekly import MAX_FFILL_WEEKS, to_weekly, week_start


def _daily(dates: list[str], prices: list[float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": pd.to_datetime(dates),
            "market": "Puttur",
            "variety": "Coca",
            "min_price": np.array(prices) * 0.9,
            "max_price": np.array(prices) * 1.1,
            "modal_price": prices,
            "arrivals_tonnes": np.nan,
        }
    )


def test_week_start_is_monday():
    d = pd.Series(pd.to_datetime(["2026-09-21", "2026-09-26", "2026-09-27"]))
    assert (week_start(d) == pd.Timestamp("2026-09-21")).all()


def test_weekly_median_and_bounded_forward_fill():
    daily = _daily(
        ["2026-01-05", "2026-01-07", "2026-01-09", "2026-01-12", "2026-03-02"],
        [20_000, 21_000, 30_000, 22_000, 25_000],
    )
    weekly = to_weekly(daily).set_index("week")

    assert weekly.loc["2026-01-05", "price"] == 21_000  # median, robust to the 30k outlier
    assert weekly.loc["2026-01-05", "n_obs"] == 3
    gap = weekly.loc["2026-01-19":"2026-02-23"]
    assert not gap["observed"].any()
    assert gap["price"].iloc[:MAX_FFILL_WEEKS].eq(22_000).all()
    assert gap["price"].iloc[MAX_FFILL_WEEKS:].isna().all()
    assert weekly.loc["2026-03-02", "price"] == 25_000


def test_features_have_no_lookahead(small_weekly, small_rain, small_feats):
    """Features at origin t must not change when every week after t is deleted."""
    origin = small_weekly["week"].max() - pd.Timedelta(weeks=30)
    truncated = build_features(
        small_weekly[small_weekly["week"] <= origin],
        small_rain[small_rain["week"] <= origin],
    )
    key = ["series_id", "h"]
    full_rows = small_feats[small_feats["week"] == origin].set_index(key, drop=False)
    cut_rows = truncated[truncated["week"] == origin].set_index(key, drop=False)
    pd.testing.assert_frame_equal(
        full_rows[FEATURE_COLUMNS].sort_index(), cut_rows[FEATURE_COLUMNS].sort_index()
    )
    # ...and the truncated table cannot know any outcome after the origin.
    assert truncated.loc[truncated["target_week"] > origin, "y"].isna().all()


def test_target_is_future_log_return(small_weekly, small_feats):
    sid = small_feats["series_id"].iloc[0]
    series = small_weekly[small_weekly["series_id"] == sid].set_index("week")["price"]
    row = small_feats[(small_feats["series_id"] == sid) & (small_feats["h"] == 4)].iloc[200]
    expected = np.log(series[row["target_week"]] / series[row["week"]])
    assert row["y"] == pytest.approx(expected)
    assert row["lp"] == pytest.approx(np.log(series[row["week"]]))


def test_seasonal_feature_uses_last_years_same_window(small_weekly, small_feats):
    sid = small_feats["series_id"].iloc[0]
    series = small_weekly[small_weekly["series_id"] == sid].set_index("week")["price"]
    row = small_feats[(small_feats["series_id"] == sid) & (small_feats["h"] == 6)].iloc[-1]
    t = row["week"]
    expected = np.log(series[t + pd.Timedelta(weeks=6 - 52)] / series[t - pd.Timedelta(weeks=52)])
    assert row["seas_ret_1y"] == pytest.approx(expected)


def test_latest_origin_has_all_horizons_and_unknown_targets(small_feats):
    last = small_feats["week"].max()
    rows = small_feats[small_feats["week"] == last]
    assert sorted(rows["h"].unique()) == list(range(1, 13))
    assert rows["y"].isna().all()
