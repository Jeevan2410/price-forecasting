"""Static configuration shared by every pipeline stage."""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"
RAW_PRICES_CSV = DATA_DIR / "raw" / "agmarknet_arecanut_dk.csv"
RAW_WEATHER_CSV = DATA_DIR / "raw" / "weather_mangaluru.csv"
DASHBOARD_JSON = REPO_ROOT / "src" / "data" / "dashboard.json"

STATE = "Karnataka"
DISTRICT = "Dakshina Kannada"
COMMODITY = "Arecanut(Betelnut/Supari)"

# Mangaluru (Bajpe) — rainfall proxy for the whole district.
WEATHER_LAT = 12.87
WEATHER_LON = 74.88

MARKETS: tuple[str, ...] = ("Mangalore", "Bantwala", "Puttur", "Sullia", "Belthangady")
VARIETIES: tuple[str, ...] = ("New Variety", "Old Variety", "Coca")

# Agmarknet spells some DK markets several ways; map them to one canonical name.
MARKET_ALIASES: dict[str, str] = {
    "mangalore": "Mangalore",
    "mangaluru": "Mangalore",
    "bantwala": "Bantwala",
    "bantwal": "Bantwala",
    "puttur": "Puttur",
    "sullia": "Sullia",
    "sulya": "Sullia",
    "belthangady": "Belthangady",
    "belthangadi": "Belthangady",
    "beltangadi": "Belthangady",
    "beltangady": "Belthangady",
}

HORIZONS: tuple[int, ...] = tuple(range(1, 13))
REPORT_HORIZONS: tuple[int, ...] = (1, 4, 8, 12)
QUANTILES: tuple[float, ...] = (0.1, 0.5, 0.9)

# Real data is used once at least one series has two years of weekly history.
MIN_WEEKS_FOR_REAL = 104
# Series without an observation in this many weeks are flagged stale in the export.
STALE_AFTER_WEEKS = 6
# Weeks of history shipped to the web app per series.
EXPORT_HISTORY_WEEKS = 260

# Sanity bounds for a modal price (₹/quintal); anything outside is a data-entry error.
PRICE_FLOOR = 2_000
PRICE_CEILING = 150_000


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def series_id(market: str, variety: str) -> str:
    return f"{slugify(market)}--{slugify(variety)}"
