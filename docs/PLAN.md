# AdikeCast — Arecanut price forecasting & sell-timing signals

**Plan, design and delivery notes.** This is the build brief the project was developed against.

## 1. Problem

Arecanut (*adike*) is the main cash crop for most farming households in Dakshina Kannada (DK).
Prices swing hard: in the same week the modal price can be ₹20,000/qtl for Coca in Bantwala
and ₹37,000/qtl for New Variety chali in Mangaluru. The seasonal pattern is fairly predictable: prices peak around
February, harvest arrivals push them down in spring, and they recover through the monsoon lean season.
Studies from Shivamogga found that farmers earn more by selling in July–September.

Farmers decide *when* and *where* to sell with WhatsApp rumours and the trader's word.
A 2024 academic study forecast DK arecanut prices with ARIMA on 2003–2024 data. We can
do better by pooling markets and varieties in a gradient-boosted model with seasonal, arrivals
and rainfall features. We also report accuracy openly, because MSME and farmer buyers want to
see the value before they trust a tool.

## 2. Users & jobs-to-be-done

| User | Job | What they need from us |
| --- | --- | --- |
| Farmer holding 5–50 qtl of dried chali | "Should I sell this week or hold?" | One clear **SELL / HOLD / SELL PART** signal in Kannada, the expected gain in ₹, and a best week to sell |
| Farmer / FPO | "Which market pays best for my variety?" | Market-by-market comparison with the premium over the nearest market |
| Trader / co-op (CAMPCO, TSS etc.) | Procurement planning, B2B dashboard | 12-week forecast with uncertainty bands, a JSON API and a downloadable feed |
| WhatsApp group admins | Share a daily update | A pre-written Kannada/English message with a one-tap WhatsApp share |

## 3. Scope — v1 (this repo)

1. **District overview**: latest modal price for every market × variety in DK, week-on-week change,
   signal badge, best market per variety.
2. **Series detail** (market × variety): price history plus a 12-week forecast fan (P10–P50–P90),
   the sell/hold signal, an interactive **sell calculator** (quantity, storage loss, interest rate),
   the seasonal profile, a comparison with other markets, and a WhatsApp share button.
3. **Accuracy page**: rolling-origin backtest of four models (Naive, Seasonal-naive, ARIMA,
   Gradient boosting) with MAPE, directional accuracy and P10–P90 interval coverage.
4. **English + Kannada UI** (`/en`, `/kn`).
5. **Public JSON API** (`/api/v1/...`): series, forecast, signal (with custom holding costs),
   and a WhatsApp-ready alert text.
6. **Data pipeline**: a daily GitHub Actions job fetches Agmarknet prices (data.gov.in) and Open-Meteo
   rainfall, retrains, backtests, and commits `src/data/dashboard.json`. The push triggers a Vercel redeploy.

Out of scope for v1, listed in the roadmap: user accounts, stored subscriptions, business-initiated
WhatsApp sends (these need a Meta-approved template), payments, and ideas #2 (kirana demand) and #3 (fish prices).

## 4. Architecture

```
            ┌──────────────── GitHub Actions (daily 19:30 IST) ────────────────┐
            │  ml/ (Python)                                                    │
data.gov.in ─► ingest → weekly agg → features → models → backtest → export ────►│ src/data/dashboard.json
Agmarknet CSV ┘            ▲                                                   │   (git commit)
Open-Meteo ──────────────┘                                                     │
            └──────────────────────────────────────────────────────────────────┘
                                          │ push to main
                                          ▼
                     Vercel: Next.js 16 (static pages + route handlers)
                     /en, /kn  ·  /[lang]/market/[id]  ·  /[lang]/accuracy  ·  /api/v1/*
                     sell/hold decision logic in TypeScript (src/lib/signal.ts)
```

**Why this split.**
- *Batch ML, static serving.* Prices update once a day, so no inference server is needed.
  The pipeline writes one JSON file. The site is prerendered and costs nothing on Vercel Hobby.
- *Forecasting in Python, decisions in TypeScript.* The model outputs price quantiles. The
  sell/hold decision depends on each farmer's holding costs, so it runs in the browser and in the API
  from one tested TypeScript module (`src/lib/signal.ts`).
- *No database in v1.* Git history is the data store (an auditable, diffable record of every
  forecast). Postgres and Upstash only become necessary when subscriptions arrive.

## 5. Data

| Source | What | Access | Used for |
| --- | --- | --- | --- |
| Agmarknet via data.gov.in (resource `9ef84268-…`) | Daily min/max/modal price per market × variety | Free API key | Daily append |
| Agmarknet / CEDA CSV export | Historical prices (and arrivals) | Manual download | One-time backfill (`import-csv`) |
| Open-Meteo archive | Daily rainfall, Mangaluru | Free, no key | Monsoon features |

**Markets:** Mangaluru, Bantwala, Puttur, Sullia, Belthangady.
**Varieties:** New Variety (*hosa chali*), Old Variety (*hale chali*), Coca (*koka*).

**Demo data.** The build sandbox cannot reach government APIs. Until a real history is
ingested, the pipeline generates a **synthetic** series calibrated to the published ranges above:
a February peak, a spring trough, Coca at about 0.62× chali, and small market premiums. The UI shows a
banner whenever `meta.dataSource == "synthetic"`, and the synthetic series is never presented as real.

## 6. Forecasting approach

- **Unit of analysis:** weekly (Monday-start) median modal price per market × variety. Daily
  mandi data is sparse and noisy, and farmers decide week by week.
- **Target:** log return over *h* weeks, `log(P[t+h] / P[t])`, for h = 1…12. Returns are scale-free,
  so one model pools all 15 series.
- **Features, all known at forecast origin t:** returns over 1/2/4/8/13/26/52 weeks; 8- and 26-week
  volatility; price vs its 52-week mean; *last year's move over the same window*
  (`log P[t+h-52] / P[t-52]`), which is the key seasonal signal; target week-of-year (sin/cos); horizon;
  market and variety codes; arrivals level and YoY change when available; 4- and 13-week rainfall and
  its anomaly.
- **Model:** gradient-boosted trees with quantile loss at P10, P50 and P90 (scikit-learn
  `HistGradientBoostingRegressor`, the same model family as XGBoost and LightGBM, with no extra native
  dependency). Quantiles are sorted to prevent crossing.
- **Baselines:** Naive (last price), Seasonal-naive (last year's move), and ARIMA(1,1,1) on log price,
  as a stand-in for the ARIMA study.
- **Evaluation:** rolling-origin backtest over the last 104 weeks with an origin every 4 weeks.
  Metrics are MAPE and directional accuracy at h = 1, 4, 8 and 12, plus P10–P90 coverage (target ≈ 80%).
  The table is published on the site. If a baseline wins, the site says so.

## 7. Sell / hold decision logic

For current price `P0` and forecast quantiles at each horizon *h*:

- Holding cost to week *h*: storage/quality loss `ℓ·h/4.35` (share of the crop per month, default 0.5%)
  plus opportunity cost `r·h/52` of not having the cash (default 12%/yr).
- Net gain of holding: `G_h = q_h·(1 − loss_h) − P0·(1 + r_h)` for q ∈ {P10, P50, P90}.
- Probability that holding pays: fit a log-normal to the quantiles
  (μ = ln P50, σ = (ln P90 − ln P10)/2.563) and compute `P(price_h > P0·(1+r_h)/(1−loss_h))`.
- Best week `h* = argmax G50_h`.
- **SELL NOW** if `G50_h*/P0 < 3%`. Holding doesn't pay after costs.
- **HOLD until week h\*** if the gain is at least 3% and `P(gain) ≥ 65%`.
- **SELL PART (≈ half)** otherwise: the upside is likely but uncertain, so the farmer should spread risk.
- A **downside flag** shows when `G10_h*/P0 < −8%`.

Thresholds are parameters, and the API and calculator expose them.

## 8. Quality plan

| Layer | Tooling | What is covered |
| --- | --- | --- |
| ML | pytest, ruff | CSV/API normalisation, weekly aggregation, **no look-ahead leakage** in features, model shapes and quantile ordering, backtest integrity, export schema |
| Web logic | Vitest | Signal maths (edge cases, monotonicity), i18n completeness (every key present in `kn`), message builder, data selectors, JSON contract check against the zod schema |
| Web E2E | Playwright | Overview renders, navigate to a market, calculator reacts, Kannada toggle, API returns JSON |
| CI | GitHub Actions | lint, typecheck, unit tests, `next build`, pytest on every push and PR |

## 9. Delivery

1. Scaffold (Next.js 16 + Tailwind 4; Python package in `ml/`)
2. Pipeline with synthetic seed, then export JSON
3. Web UI and API against the JSON contract
4. Tests and CI
5. Push to GitHub, then link a Vercel project to the repo (auto-deploy on push to `main`)
6. Owner steps: add the `DATA_GOV_IN_API_KEY` secret, run the backfill, and review the Kannada copy with a native speaker

## 10. Roadmap / monetisation

- **v1.1:** Kannada WhatsApp alerts via the WhatsApp Cloud API (approved template) with Vercel Cron and a
  subscriber table (Neon/Upstash); price-target alerts.
- **v1.2:** Arrivals-aware features from the CEDA backfill; Shivamogga, Uttara Kannada and Kasaragod markets.
- **Pricing:** Free web signal. ₹99–149/month for personal WhatsApp alerts (benchmark: ACROP AI
  from ₹150/mo). B2B API and dashboard for traders and co-ops.
- **Next ideas:** #2 kirana/MSME demand-and-reorder forecasting (sell the ROI number: stockouts avoided
  and working capital freed). #3 fish landing and price predictor for Mangaluru/Malpe (CMFRI Fish Watch).
