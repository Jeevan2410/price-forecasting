# Raw data

Files here are written by the pipeline (`python -m arecanut_ml ...`) and committed by the daily
refresh workflow, so the git history doubles as an audit log.

| File | Written by | Columns |
| --- | --- | --- |
| `raw/agmarknet_arecanut_dk.csv` | `fetch-prices`, `import-csv` | `date, market, variety, min_price, max_price, modal_price, arrivals_tonnes` (₹/quintal, tonnes) |
| `raw/weather_mangaluru.csv` | `fetch-weather` | `date, precip_mm` |

Neither file exists while the site runs on the synthetic demo series.
