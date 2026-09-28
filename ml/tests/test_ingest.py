from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from arecanut_ml import ingest


def test_normalizes_agmarknet_report_export():
    raw = pd.DataFrame(
        {
            "Sl no.": [1, 2, 3, 4],
            "District Name": ["Dakshina Kannada"] * 2 + ["Shimoga", "Dakshina Kannada"],
            "Market Name": ["Mangalore", "Bantwal", "Shimoga", "Belthangadi"],
            "Commodity": ["Arecanut(Betelnut/Supari)"] * 4,
            "Variety": ["New Variety", "Coca", "Rashi", "old variety"],
            "Grade": ["FAQ"] * 4,
            "Min Price (Rs./Quintal)": ["30,000", "18000", "45000", "33000"],
            "Max Price (Rs./Quintal)": ["37,000", "21000", "52000", "39000"],
            "Modal Price (Rs./Quintal)": ["35,500", "20000", "50000", "37000"],
            "Price Date": ["21 Sep 2026", "22 Sep 2026", "21 Sep 2026", "23 Sep 2026"],
        }
    )
    out = ingest.normalize_prices(raw)

    assert list(out.columns) == ingest.PRICE_COLUMNS
    assert len(out) == 3, "the Shimoga row belongs to another district"
    assert set(out["market"]) == {"Mangalore", "Bantwala", "Belthangady"}
    assert set(out["variety"]) == {"New Variety", "Coca", "Old Variety"}
    mangalore = out[out["market"] == "Mangalore"].iloc[0]
    assert mangalore["modal_price"] == 35_500
    assert mangalore["min_price"] == 30_000
    assert mangalore["date"] == pd.Timestamp("2026-09-21")
    assert out["arrivals_tonnes"].isna().all()


def test_normalizes_datagov_json_records():
    records = [
        {
            "state": "Karnataka",
            "district": "Dakshina Kannada",
            "market": "Puttur",
            "commodity": "Arecanut(Betelnut/Supari)",
            "variety": "New Variety",
            "grade": "FAQ",
            "arrival_date": "05/09/2026",
            "min_price": "31000",
            "max_price": "36500",
            "modal_price": "34000",
        },
        {
            "state": "Karnataka",
            "district": "Dakshina Kannada",
            "market": "Puttur",
            "commodity": "Coconut",
            "variety": "Other",
            "grade": "FAQ",
            "arrival_date": "05/09/2026",
            "min_price": "3000",
            "max_price": "3500",
            "modal_price": "3200",
        },
    ]
    out = ingest.normalize_prices(pd.DataFrame(records))
    assert len(out) == 1
    # Day-first: 5 September, not 9 May.
    assert out.iloc[0]["date"] == pd.Timestamp("2026-09-05")


def test_drops_implausible_prices_and_bad_dates():
    raw = pd.DataFrame(
        {
            "date": ["2026-09-01", "not a date", "2026-09-02", "2026-09-03"],
            "market": ["Sullia"] * 4,
            "variety": ["Coca"] * 4,
            "modal_price": [21_000, 21_000, 0, 9_999_999],
        }
    )
    out = ingest.normalize_prices(raw)
    assert len(out) == 1
    assert out.iloc[0]["modal_price"] == 21_000


def test_missing_required_column_is_an_error():
    with pytest.raises(ValueError, match="modal_price"):
        ingest.normalize_prices(pd.DataFrame({"date": ["2026-01-01"], "market": ["Puttur"]}))


def test_merge_prices_newer_row_wins():
    base = pd.DataFrame(
        {
            "date": pd.to_datetime(["2026-09-01", "2026-09-02"]),
            "market": ["Puttur", "Puttur"],
            "variety": ["Coca", "Coca"],
            "min_price": [np.nan, np.nan],
            "max_price": [np.nan, np.nan],
            "modal_price": [20_000.0, 20_100.0],
            "arrivals_tonnes": [np.nan, np.nan],
        }
    )
    update = base.iloc[[1]].assign(modal_price=20_500.0)
    merged = ingest.merge_prices(base, update)
    assert len(merged) == 2
    assert merged.iloc[1]["modal_price"] == 20_500


class FakeResponse:
    status_code = 200
    ok = True
    text = ""

    def __init__(self, payload: dict):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class FakeSession:
    def __init__(self, pages: list[dict]):
        self.pages = pages
        self.calls: list[dict] = []

    def get(self, url, params=None, timeout=None):
        self.calls.append({"url": url, "params": params})
        return FakeResponse(self.pages[len(self.calls) - 1])


def _record(market: str, day: int) -> dict:
    return {
        "state": "Karnataka",
        "district": "Dakshina Kannada",
        "market": market,
        "commodity": "Arecanut(Betelnut/Supari)",
        "variety": "New Variety",
        "arrival_date": f"{day:02d}/09/2026",
        "min_price": "30000",
        "max_price": "36000",
        "modal_price": "34000",
    }


def test_fetch_datagov_paginates_and_normalizes():
    pages = [
        {"total": 3, "records": [_record("Mangalore", 1), _record("Puttur", 1)]},
        {"total": 3, "records": [_record("Sullia", 2)]},
    ]
    session = FakeSession(pages)
    out = ingest.fetch_datagov("KEY", page_size=2, session=session)

    assert len(session.calls) == 2
    assert session.calls[1]["params"]["offset"] == 2
    assert session.calls[0]["params"]["api-key"] == "KEY"
    assert sorted(out["market"]) == ["Mangalore", "Puttur", "Sullia"]


def test_fetch_open_meteo_parses_daily_payload():
    payload = {
        "daily": {
            "time": ["2026-07-01", "2026-07-02"],
            "precipitation_sum": [85.2, None],
        }
    }
    out = ingest.fetch_open_meteo("2026-07-01", "2026-07-02", session=FakeSession([payload]))
    assert list(out.columns) == ingest.WEATHER_COLUMNS
    assert len(out) == 1
    assert out.iloc[0]["precip_mm"] == pytest.approx(85.2)


def test_csv_round_trip(tmp_path, small_prices):
    path = tmp_path / "prices.csv"
    ingest.write_prices_csv(small_prices, path)
    back = ingest.read_prices_csv(path)
    assert back is not None
    pd.testing.assert_frame_equal(
        back.reset_index(drop=True), small_prices.reset_index(drop=True), check_dtype=False
    )
