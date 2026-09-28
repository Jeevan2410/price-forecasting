"""Command line entry point: ``python -m arecanut_ml <command>``."""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import os
import sys
from pathlib import Path

import pandas as pd

from . import ingest
from .config import DASHBOARD_JSON, RAW_PRICES_CSV, RAW_WEATHER_CSV
from .pipeline import run

log = logging.getLogger("arecanut_ml")


def cmd_run(args: argparse.Namespace) -> int:
    payload = run(
        mode=args.mode,
        out=Path(args.out),
        as_of=args.as_of,
        backtest=not args.no_backtest,
    )
    bt = payload["backtest"]
    print(
        f"{payload['meta']['dataSource']}: {len(payload['series'])} series, "
        f"last week {payload['meta']['lastWeek']}, champion={bt.get('champion')}"
    )
    for m in bt.get("models", []):
        print(f"  {m['label']:<28} avg MAPE {m['mapeAvg']:.2f}%")
    return 0


def _save_prices(new: pd.DataFrame, label: str) -> None:
    existing = ingest.read_prices_csv(RAW_PRICES_CSV)
    merged = ingest.merge_prices(existing, new)
    ingest.write_prices_csv(merged, RAW_PRICES_CSV)
    before = 0 if existing is None else len(existing)
    print(f"{label}: {len(new)} DK rows fetched, {len(merged) - before} new, {len(merged)} total")


def cmd_fetch_prices(args: argparse.Namespace) -> int:
    """Recent prices: Agmarknet report API (no key), plus data.gov.in when a key is set.

    Re-reading the last few weeks catches late uploads and corrections.
    """
    today = dt.date.today()
    first_fetch = ingest.read_prices_csv(RAW_PRICES_CSV) is None
    start = ingest.AGMARKNET_EARLIEST if first_fetch else today - dt.timedelta(days=21)
    _save_prices(ingest.fetch_agmarknet(start, today), f"agmarknet {start}..{today}")

    key = os.environ.get("DATA_GOV_IN_API_KEY")
    if key:
        _save_prices(ingest.fetch_datagov(key), "data.gov.in")
    return 0


def cmd_backfill(args: argparse.Namespace) -> int:
    """Full history from the Agmarknet report API (prices start 2021-01-01)."""
    start = dt.date.fromisoformat(args.start)
    _save_prices(ingest.fetch_agmarknet(start, dt.date.today()), f"agmarknet backfill {start}..")
    return 0


def cmd_fetch_weather(args: argparse.Namespace) -> int:
    existing = ingest.read_weather_csv(RAW_WEATHER_CSV)
    start = args.start
    if existing is not None and not existing.empty and not args.full:
        start = (existing["date"].max() - pd.Timedelta(days=14)).strftime("%Y-%m-%d")
    end = (pd.Timestamp.now(tz="Asia/Kolkata") - pd.Timedelta(days=2)).strftime("%Y-%m-%d")
    new = ingest.fetch_open_meteo(start, end)
    merged = ingest.merge_weather(existing, new)
    ingest.write_weather_csv(merged, RAW_WEATHER_CSV)
    print(f"weather: {len(new)} days fetched ({start}..{end}), {len(merged)} total")
    return 0


def cmd_import_csv(args: argparse.Namespace) -> int:
    new = ingest.import_csv_files([Path(p) for p in args.paths])
    existing = ingest.read_prices_csv(RAW_PRICES_CSV)
    merged = ingest.merge_prices(existing, new)
    ingest.write_prices_csv(merged, RAW_PRICES_CSV)
    print(f"imported {len(new)} DK arecanut rows; {len(merged)} rows in {RAW_PRICES_CSV}")
    return 0


def cmd_refresh(args: argparse.Namespace) -> int:
    """Daily job: fetch whatever sources are reachable, then rebuild the dashboard."""
    for step in (cmd_fetch_prices, cmd_fetch_weather):
        try:
            step(args)
        except Exception as exc:  # a flaky upstream must not block the rebuild
            log.error("%s failed: %s", step.__name__, exc)
    return cmd_run(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="arecanut_ml", description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_run_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--mode", choices=["auto", "synthetic", "real"], default="auto")
        p.add_argument("--out", default=str(DASHBOARD_JSON))
        p.add_argument("--as-of", default=None, help="YYYY-MM-DD; defaults to today (IST)")
        p.add_argument("--no-backtest", action="store_true")

    p_run = sub.add_parser("run", help="build forecasts and export dashboard JSON")
    add_run_args(p_run)
    p_run.set_defaults(func=cmd_run)

    p_prices = sub.add_parser(
        "fetch-prices", help="append recent prices (Agmarknet API; data.gov.in if keyed)"
    )
    p_prices.set_defaults(func=cmd_fetch_prices)

    p_backfill = sub.add_parser("backfill", help="download full history from Agmarknet")
    p_backfill.add_argument("--start", default="2021-01-01", help="YYYY-MM-DD")
    p_backfill.set_defaults(func=cmd_backfill)

    p_weather = sub.add_parser("fetch-weather", help="update Mangaluru rainfall (Open-Meteo)")
    p_weather.add_argument("--start", default="2016-01-01")
    p_weather.add_argument("--full", action="store_true", help="refetch from --start")
    p_weather.set_defaults(func=cmd_fetch_weather)

    p_import = sub.add_parser("import-csv", help="import Agmarknet/CEDA CSV or Excel exports")
    p_import.add_argument("paths", nargs="+")
    p_import.set_defaults(func=cmd_import_csv)

    p_refresh = sub.add_parser("refresh", help="fetch prices + weather, then run")
    add_run_args(p_refresh)
    p_refresh.add_argument("--start", default="2016-01-01")
    p_refresh.add_argument("--full", action="store_true")
    p_refresh.set_defaults(func=cmd_refresh)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
