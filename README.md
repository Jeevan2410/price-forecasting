# AdikeCast: arecanut price forecasts and sell signals

Weekly arecanut (*adike*) price forecasts for the Dakshina Kannada mandis (Mangaluru, Bantwal, Puttur,
Sullia, Belthangady), turned into a plain **Sell now / Hold / Sell part** signal for farmers. Available
in English and Kannada, with a sell calculator, WhatsApp sharing and a free JSON API for traders and co-ops.

> The site starts on a *synthetic* demo series. It switches to real Agmarknet prices automatically
> once two years of history have been imported (see [Data](#data)). While it is on demo data, every
> page shows a banner saying so.

The plan and design rationale are in [`docs/PLAN.md`](docs/PLAN.md).

## What's inside

| Path | What |
| --- | --- |
| `src/app/[lang]/` | Next.js 16 pages: overview, `market/[id]`, `accuracy`, `about` (en + kn) |
| `src/app/api/v1/` | JSON API: series, signal (custom costs), WhatsApp alert text |
| `src/lib/signal.ts` | Sell/hold decision maths (unit-tested) |
| `src/lib/i18n.ts` | English + Kannada copy (the typecheck fails if a key is missing) |
| `src/data/dashboard.json` | Pipeline output, validated with zod at build time |
| `ml/` | Python pipeline: ingest, weekly panel, features, models, backtest, export |
| `.github/workflows/` | CI, plus the daily data refresh (19:30 IST) that commits new forecasts |

```
Agmarknet CSV export / data.gov.in daily feed / Open-Meteo
        │  (GitHub Actions, daily)
        ▼
ml/: weekly median price → features → gradient boosting (P10/P50/P90)
     → rolling backtest vs Naive / Seasonal-naive / ARIMA → conformal calibration
        │  commits src/data/dashboard.json
        ▼
Vercel: Next.js static pages + API routes; sell/hold logic runs in TypeScript
```

## Quick start

```bash
# Web app (Node 20.9+)
npm install
npm run dev            # http://localhost:3000 → /en

# Forecasting pipeline (Python 3.11+)
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m arecanut_ml run            # rebuilds src/data/dashboard.json (~5 min with backtest)
python -m arecanut_ml run --no-backtest   # ~15 s
```

## Tests

```bash
npm run lint && npm run typecheck
npm test                              # Vitest: signal maths, i18n completeness, data contract, alerts
npm run build && npm run test:e2e     # Playwright on desktop + mobile against the production build
cd ml && ruff check . && pytest       # ingest parsing, no look-ahead leakage, models, backtest, export
```

## Data

**Getting real prices.** There are two parts:

1. **History (one time, by hand).** The model needs about two years of prices. Agmarknet's
   report API requires a CAPTCHA, so this can't be automated. Download the history on the website instead:
   - [agmarknet.gov.in](https://agmarknet.gov.in) → *Daily Price and Arrival Report* → Commodity
     *Arecanut(Betelnut/Supari)*, State *Karnataka*, District *Dakshina Kannada*, a date range, then
     export. Repeat per year if one export is capped.
   - or [CEDA Agri Market Data](https://agmarknet.ceda.ashoka.edu.in/) → Arecanut → Karnataka →
     Dakshina Kannada → download CSV (a free login may be required).

   Then import and commit:
   ```bash
   cd ml && python -m arecanut_ml import-csv ~/Downloads/*.csv ~/Downloads/*.xlsx
   git add data/raw && git commit -m "data: import Agmarknet history" && git push
   ```
   The column names of both exports are recognised, and non-DK or non-arecanut rows are dropped.

2. **Daily updates (automatic).** The refresh workflow appends each day's rows from data.gov.in's
   Agmarknet feed. It works without registering, using the portal's published demo key (10 rows per
   request). A personal key (`DATA_GOV_IN_API_KEY` secret, free at data.gov.in → My Account)
   is faster and more reliable.

The pipeline switches from synthetic to real data by itself once any market has at least
104 weeks of history (`--mode real` forces it).

**Synthetic demo series.** `ml/src/arecanut_ml/synthetic.py` generates daily mandi rows with a
February peak and a spring trough, Coca at about 0.62× chali, small market premiums, a monsoon rainfall
effect and mean-reverting multi-year cycles. It is deterministic and labelled `dataSource: "synthetic"`
everywhere. It exists so the whole product can be built and tested before real data is connected. It
is **not** real market data, and the accuracy numbers measured on it don't describe real-world accuracy.

## Model

- Weekly median modal price per market × variety. Gaps of up to 3 weeks are forward-filled.
- One pooled `HistGradientBoostingRegressor` (quantile loss, P10/P50/P90) predicts the log return
  1–12 weeks ahead. Features: recent returns and volatility, deviation from the 52-week mean, *last
  year's move over the same window*, target week-of-year, rainfall anomaly, arrivals, market/variety.
- Rolling-origin backtest (26 origins over 2 years, refit at each) against Naive, Seasonal-naive and
  ARIMA(1,1,1). A test checks that features never see the future.
- The P10–P90 band is widened by **conformalised quantile regression** on the backtest errors, so it
  contains the outcome about 80% of the time. The reported coverage is leave-one-origin-out, so it is honest.

On the demo series: average MAPE is 3.6% vs 4.0% for ARIMA, direction is right 77% of the time at 8 weeks,
and 80% band coverage. At one week ahead the simple baselines are as good or better, and the site says so.

## API

Free, read-only, CORS-enabled, and cached at the edge for an hour.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/series` | All series: latest price, changes, 12-week outlook, default signal |
| `GET /api/v1/series/{id}` | History, forecast quantiles and seasonality for one series |
| `GET /api/v1/signal/{id}?storageLoss=0.5&interest=12&quantity=20` | Signal with your holding costs, plus a revenue plan |
| `GET /api/v1/alert/{id}?lang=kn` | WhatsApp-ready text and a `wa.me` share link |

Series ids look like `mangalore--new-variety`, `bantwala--coca`.

## Deploy

Vercel (zero config): import the GitHub repo and it detects Next.js. Every push to `main`,
including the daily data commit, deploys. Optional: set `NEXT_PUBLIC_SITE_URL` if you add a custom domain,
and `VERCEL_DEPLOY_HOOK_URL` as a GitHub secret if bot commits ever stop triggering deploys.

## Before a public launch

- [ ] Re-read the accuracy page once it is computed on real prices.
- [ ] Have a native Kannada speaker from DK review `src/lib/i18n.ts` and the About page.
- [ ] Confirm the data.gov.in feed returns Dakshina Kannada arecanut rows (check the refresh
      workflow log for "data.gov.in: N DK rows fetched").

## Roadmap

WhatsApp Cloud API subscriptions (Kannada template messages via Vercel Cron), price-target alerts,
more districts (Shivamogga, Uttara Kannada, Kasaragod), arrivals-aware features from the CEDA backfill, and a
B2B dashboard for traders and co-ops. See `docs/PLAN.md` §10.
