"""Load, normalise and merge raw price and weather data.

Every price source is reduced to one schema::

    date | market | variety | min_price | max_price | modal_price | arrivals_tonnes

Prices are in Rs per quintal. ``arrivals_tonnes`` is NaN when the source has no arrivals.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from .config import (
    COMMODITY,
    DISTRICT,
    MARKET_ALIASES,
    PRICE_CEILING,
    PRICE_FLOOR,
    STATE,
    WEATHER_LAT,
    WEATHER_LON,
)

log = logging.getLogger(__name__)

PRICE_COLUMNS = [
    "date",
    "market",
    "variety",
    "min_price",
    "max_price",
    "modal_price",
    "arrivals_tonnes",
]
WEATHER_COLUMNS = ["date", "precip_mm"]

# data.gov.in: "Current Daily Price of Various Commodities from Various Markets (Mandi)".
DATAGOV_DAILY_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"
DATAGOV_BASE = "https://api.data.gov.in/resource"
# Public sample key published on data.gov.in's API pages; capped at 10 records per request.
DATAGOV_DEMO_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"
OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"


# Column names seen across data.gov.in JSON, Agmarknet report exports and CEDA downloads,
# after lower-casing and stripping everything except letters and digits.
_COLUMN_ALIASES: dict[str, tuple[str, ...]] = {
    "date": ("arrivaldate", "pricedate", "reporteddate", "date", "tdate"),
    "market": ("market", "marketname", "mandi", "mandiname", "apmc"),
    "variety": ("variety", "varietyname"),
    "district": ("district", "districtname"),
    "state": ("state", "statename"),
    "commodity": ("commodity", "commodityname"),
    "min_price": ("minprice", "minimumprice", "minpricersquintal", "minpricers", "minx0020price"),
    "max_price": ("maxprice", "maximumprice", "maxpricersquintal", "maxpricers", "maxx0020price"),
    "modal_price": ("modalprice", "modalpricersquintal", "modalpricers", "modalx0020price"),
    "arrivals_tonnes": ("arrivals", "arrivalstonnes", "arrivalsintonnes", "arrivalquantity"),
}


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def _rename_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename: dict[str, str] = {}
    for col in df.columns:
        key = _key(col)
        for target, aliases in _COLUMN_ALIASES.items():
            if target in rename.values():
                continue
            if key in aliases:
                rename[col] = target
                break
    return df.rename(columns=rename)


def canonical_market(name: str) -> str:
    key = _key(name)
    return MARKET_ALIASES.get(key, str(name).strip().title())


def canonical_variety(name: str) -> str:
    text = re.sub(r"\s+", " ", str(name)).strip()
    lowered = text.lower()
    if lowered in {"new", "new variety", "hosa chali", "chali new"}:
        return "New Variety"
    if lowered in {"old", "old variety", "hale chali", "chali old"}:
        return "Old Variety"
    if lowered in {"coca", "koka", "coka"}:
        return "Coca"
    return text.title()


def _parse_dates(values: pd.Series) -> pd.Series:
    text = values.astype(str).str.strip()
    parsed = pd.to_datetime(text, format="%Y-%m-%d", errors="coerce")
    remaining = parsed.isna()
    if remaining.any():
        # Agmarknet and data.gov.in use day-first dates ("21/09/2026", "21-Sep-2026").
        parsed = parsed.where(
            ~remaining,
            pd.to_datetime(text.where(remaining), format="mixed", dayfirst=True, errors="coerce"),
        )
    return parsed.dt.normalize()


def normalize_prices(raw: pd.DataFrame) -> pd.DataFrame:
    """Coerce any supported price table into :data:`PRICE_COLUMNS`, keeping only DK arecanut."""
    df = _rename_columns(raw.copy())
    missing = {"date", "market", "modal_price"} - set(df.columns)
    if missing:
        raise ValueError(f"price data is missing required columns: {sorted(missing)}")

    if "district" in df.columns:
        df = df[df["district"].astype(str).str.lower().str.contains("dakshina", na=False)]
    if "commodity" in df.columns:
        df = df[df["commodity"].astype(str).str.lower().str.contains("arecanut", na=False)]

    out = pd.DataFrame(
        {
            "date": _parse_dates(df["date"]),
            "market": df["market"].map(canonical_market),
            "variety": df["variety"].map(canonical_variety) if "variety" in df.columns else "Other",
        }
    )
    for col in ("min_price", "max_price", "modal_price", "arrivals_tonnes"):
        if col in df.columns:
            out[col] = pd.to_numeric(
                df[col].astype(str).str.replace(",", "", regex=False), errors="coerce"
            )
        else:
            out[col] = np.nan

    ok = (
        out["date"].notna()
        & out["modal_price"].between(PRICE_FLOOR, PRICE_CEILING)
        & out["market"].astype(str).str.len().gt(0)
    )
    dropped = int((~ok).sum())
    if dropped:
        log.info("dropped %d unusable price rows", dropped)
    out = out[ok]
    return out[PRICE_COLUMNS].sort_values(["date", "market", "variety"]).reset_index(drop=True)


def merge_prices(existing: pd.DataFrame | None, new: pd.DataFrame) -> pd.DataFrame:
    """Union two normalised tables; on duplicates (date, market, variety) the newer row wins."""
    frames = [f for f in (existing, new) if f is not None and not f.empty]
    if not frames:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    merged = pd.concat(frames, ignore_index=True)
    merged = merged.drop_duplicates(["date", "market", "variety"], keep="last")
    return merged.sort_values(["date", "market", "variety"]).reset_index(drop=True)


def read_prices_csv(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"])
    return df[PRICE_COLUMNS]


def write_prices_csv(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    out.to_csv(path, index=False)


def import_csv_files(paths: Iterable[Path]) -> pd.DataFrame:
    """Read Agmarknet or CEDA exports (CSV or Excel) and return normalised rows."""
    frames = []
    for path in paths:
        suffix = path.suffix.lower()
        raw = pd.read_excel(path) if suffix in {".xls", ".xlsx"} else pd.read_csv(path)
        frames.append(normalize_prices(raw))
    if not frames:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    return merge_prices(None, pd.concat(frames, ignore_index=True))


def fetch_datagov(
    api_key: str,
    *,
    resource_id: str = DATAGOV_DAILY_RESOURCE,
    page_size: int = 500,
    max_pages: int = 40,
    session: requests.Session | None = None,
    timeout: float = 120.0,
) -> pd.DataFrame:
    """Fetch Karnataka arecanut rows from a data.gov.in Agmarknet resource.

    Filtering by district is done locally after download, because filter keys differ between
    resources and an unrecognised filter makes the API return nothing.
    """
    http = session or requests.Session()
    rows: list[dict] = []
    for page in range(max_pages):
        params = {
            "api-key": api_key,
            "format": "json",
            "limit": page_size,
            "offset": page * page_size,
            "filters[state.keyword]": STATE,
            "filters[commodity]": COMMODITY,
        }
        resp = http.get(f"{DATAGOV_BASE}/{resource_id}", params=params, timeout=timeout)
        resp.raise_for_status()
        payload = resp.json()
        records = payload.get("records") or []
        rows.extend(records)
        total = int(payload.get("total") or 0)
        if len(records) < page_size or len(rows) >= total:
            break
    log.info("data.gov.in returned %d Karnataka arecanut rows", len(rows))
    if not rows:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    df = pd.DataFrame(rows)
    df = _rename_columns(df)
    if "district" not in df.columns:
        df["district"] = DISTRICT
    return normalize_prices(df)


def normalize_weather(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.rename(columns={"time": "date", "precipitation_sum": "precip_mm"})
    out = pd.DataFrame(
        {
            "date": pd.to_datetime(df["date"]).dt.normalize(),
            "precip_mm": pd.to_numeric(df["precip_mm"], errors="coerce"),
        }
    )
    return out.dropna().sort_values("date").reset_index(drop=True)


def fetch_open_meteo(
    start: str,
    end: str,
    *,
    session: requests.Session | None = None,
    timeout: float = 60.0,
) -> pd.DataFrame:
    """Daily rainfall for Mangaluru from the free Open-Meteo archive API."""
    http = session or requests.Session()
    resp = http.get(
        OPEN_METEO_ARCHIVE,
        params={
            "latitude": WEATHER_LAT,
            "longitude": WEATHER_LON,
            "start_date": start,
            "end_date": end,
            "daily": "precipitation_sum",
            "timezone": "Asia/Kolkata",
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    daily = resp.json()["daily"]
    return normalize_weather(pd.DataFrame(daily))


def read_weather_csv(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    df = pd.read_csv(path)
    return normalize_weather(df)


def merge_weather(existing: pd.DataFrame | None, new: pd.DataFrame) -> pd.DataFrame:
    frames = [f for f in (existing, new) if f is not None and not f.empty]
    if not frames:
        return pd.DataFrame(columns=WEATHER_COLUMNS)
    merged = pd.concat(frames, ignore_index=True).drop_duplicates("date", keep="last")
    return merged.sort_values("date").reset_index(drop=True)


def write_weather_csv(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    out.to_csv(path, index=False)
