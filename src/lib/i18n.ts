/**
 * UI copy in English and Kannada. `kn` is typed against `en`, so a missing key fails typecheck.
 * The Kannada copy was drafted for this project and still needs review by a native speaker
 * from the district before a public launch (see README).
 */

export const LOCALES = ["en", "kn"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

const en = {
  langName: "English",
  brand: "AdikeCast",
  tagline: "Arecanut price forecasts and sell signals for Dakshina Kannada",
  nav: { markets: "Markets", accuracy: "Accuracy", about: "How it works" },
  switchTo: "ಕನ್ನಡ",
  perQuintal: "/qtl",
  quintals: "quintals",
  demoBanner:
    "Demo data. These prices are synthetic, generated to resemble Agmarknet patterns, so the app can be tried before the live mandi feed is connected. Do not use them to sell.",
  disclaimer:
    "Forecasts are estimates, not guarantees. Always confirm the day's rate with your trader or APMC before selling.",
  dataUpTo: (date: string) => `Mandi data up to ${date}`,
  weekOf: (date: string) => `week of ${date}`,
  source: "Source: Agmarknet (data.gov.in), Open-Meteo rainfall.",
  sourceDemo: "Source: synthetic demo series (see How it works).",

  actions: { SELL_NOW: "Sell now", HOLD: "Hold", SELL_PART: "Sell part" },
  actionLong: {
    SELL_NOW: "Sell now",
    HOLD: (date: string) => `Hold until ${date}`,
    SELL_PART: "Sell about half now",
  },
  explain: {
    SELL_NOW: (gain: string, min: string) =>
      `Holding is unlikely to pay once storage loss and interest are counted. The best expected gain is ${gain}, below the ${min} needed to make waiting worthwhile.`,
    HOLD: (date: string, gain: string, prob: string) =>
      `Prices are likely to rise. Holding until the week of ${date} is expected to add ${gain} after costs, with a ${prob} chance of beating today's price.`,
    SELL_PART: (date: string, gain: string, prob: string) =>
      `A rise of about ${gain} after costs is possible by the week of ${date}, but only a ${prob} chance. Selling about half now and holding the rest spreads the risk.`,
  },
  downside: (loss: string) =>
    `Downside risk: in a bad case (1 in 10), holding could earn ${loss} less than selling today.`,
  noForecast: "No forecast is available for this market right now.",
  stale: "No recent trades reported. Prices may be out of date.",

  overview: {
    title: "Adike prices this week",
    intro:
      "Latest modal prices from Dakshina Kannada mandis, the 12-week outlook, and whether holding your stock is likely to pay.",
    bestPrice: "Best price",
    market: "Market",
    price: "Price",
    change1w: "1 week",
    outlook: "12-week outlook",
    signal: "Signal",
    open: "Details",
    seasonTitle: "Seasonal pattern",
    seasonText: (month: string, pct: string, peak: string, peakPct: string) =>
      `Over the years, ${month} prices have run ${pct} against the yearly average. The usual peak is ${peak} (${peakPct}).`,
    howTitle: "How the signal works",
    how: [
      "We forecast each market's weekly price 12 weeks ahead, with a likely range.",
      "We subtract the cost of waiting: storage loss and interest on money you could have today.",
      "If holding is likely to earn at least 3% more, the signal says Hold. If not, it says Sell now.",
    ],
  },

  detail: {
    back: "All markets",
    latest: "This week's price",
    lastTrade: (date: string) => `Last trade ${date}`,
    range52: "52-week range",
    forecast12: "In 12 weeks",
    likelyRange: "likely range",
    signalTitle: "Should I sell?",
    bestWeek: "Best week to sell",
    expectedGain: "Expected gain after costs",
    chance: "Chance holding pays",
    perQtl: "per quintal",
    share: "Share on WhatsApp",
    chartTitle: "Price and 12-week forecast",
    chartSubtitle: "Weekly median modal price, ₹ per quintal. Shaded band: 80% likely range.",
    actual: "Actual",
    forecast: "Forecast",
    band: "80% range",
    today: "Latest",
    showTable: "Show data table",
    week: "Week",
    low: "Low (P10)",
    mid: "Expected (P50)",
    high: "High (P90)",
    range: { "1y": "1Y", "2y": "2Y", "5y": "5Y" },
    calcTitle: "Sell calculator",
    calcIntro: "Enter your stock and costs. The advice updates as you type.",
    quantity: "Stock (quintals)",
    storageLoss: "Storage loss (% per month)",
    interest: "Interest on money (% per year)",
    sellNowValue: "Sell everything today",
    holdValue: (date: string) => `Hold until ${date} (expected)`,
    splitValue: "Sell half now, half later",
    extra: "Extra after costs",
    planTitle: "Week-by-week view",
    breakEven: "Break-even price",
    chanceShort: "Chance",
    gainShort: "Gain/qtl",
    seasonTitle: "Typical price by month",
    seasonSubtitle: "Average of past years; 0% is the yearly average.",
    compareTitle: (variety: string) => `${variety}: other markets this week`,
    compareSubtitle: "Weekly median modal price, ₹ per quintal.",
    thisMarket: "this market",
  },

  accuracy: {
    title: "How accurate are the forecasts?",
    intro: (origins: number, from: string, to: string) =>
      `We re-ran every model ${origins} times on past data (${from} to ${to}), each time using only what was known then, and compared its forecast with what actually happened.`,
    demoNote:
      "These scores are measured on the synthetic demo series. They show that the pipeline works, not how well it predicts real mandi prices. They are recomputed automatically once real data is connected.",
    ours: "Our model: average error",
    bestBaseline: (name: string) => `Best simple method (${name})`,
    direction: "Direction right, 8 weeks ahead",
    coverage: "Range contains outcome",
    coverageTarget: "target 80%",
    chartTitle: "Average error by forecast horizon",
    chartSubtitle: "Mean absolute percentage error (lower is better).",
    weeksAhead: (h: number) => `${h} wk`,
    model: "Model",
    mapeAvg: "Avg. error",
    h: (h: number) => `${h} week${h === 1 ? "" : "s"}`,
    dirShort: "direction",
    shortTermNote:
      "One week ahead, the simple methods are as good or better: prices rarely move far in a week. The model earns its keep over 4 to 12 weeks, which is the range the sell decision depends on.",
    models: {
      naive: "Price stays the same",
      seasonal_naive: "Same as last year",
      arima: "ARIMA (used in earlier studies)",
      gbm: "AdikeCast model",
    } as Record<string, string>,
  },

  about: {
    title: "How it works",
  },

  share: {
    header: (market: string, variety: string) => `Adike price: ${market}, ${variety}`,
    latest: (price: string, date: string) => `This week: ${price}/qtl (${date})`,
    forecast: (weeks: number, price: string, low: string, high: string) =>
      `In ${weeks} weeks: about ${price} (likely ${low} to ${high})`,
    signal: (text: string) => `Advice: ${text}`,
    footer: "Estimate, not a guarantee. Confirm with your trader.",
  },
};

export type Dictionary = typeof en;

const kn: Dictionary = {
  langName: "ಕನ್ನಡ",
  brand: "AdikeCast",
  tagline: "ದಕ್ಷಿಣ ಕನ್ನಡದ ಅಡಿಕೆ ಬೆಲೆ ಮುನ್ಸೂಚನೆ ಮತ್ತು ಮಾರಾಟ ಸಲಹೆ",
  nav: { markets: "ಮಾರುಕಟ್ಟೆಗಳು", accuracy: "ನಿಖರತೆ", about: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ" },
  switchTo: "English",
  perQuintal: "/ಕ್ವಿಂ",
  quintals: "ಕ್ವಿಂಟಾಲ್",
  demoBanner:
    "ಪ್ರಾಯೋಗಿಕ ಮಾಹಿತಿ. ಇಲ್ಲಿರುವ ಬೆಲೆಗಳು Agmarknet ಮಾದರಿಯಲ್ಲಿ ಕೃತಕವಾಗಿ ರಚಿಸಿದವು; ನೈಜ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಜೋಡಿಸುವ ಮೊದಲು ಆ್ಯಪ್ ಪರೀಕ್ಷಿಸಲು ಮಾತ್ರ. ಮಾರಾಟಕ್ಕೆ ಇವನ್ನು ಬಳಸಬೇಡಿ.",
  disclaimer:
    "ಮುನ್ಸೂಚನೆಗಳು ಅಂದಾಜು ಮಾತ್ರ, ಖಾತರಿಯಲ್ಲ. ಮಾರುವ ಮೊದಲು ಅಂದಿನ ದರವನ್ನು ವ್ಯಾಪಾರಿ ಅಥವಾ ಎಪಿಎಂಸಿಯಲ್ಲಿ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
  dataUpTo: (date) => `${date} ವರೆಗಿನ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ`,
  weekOf: (date) => `${date} ರ ವಾರ`,
  source: "ಮೂಲ: Agmarknet (data.gov.in), Open-Meteo ಮಳೆ ಮಾಹಿತಿ.",
  sourceDemo: "ಮೂಲ: ಕೃತಕ ಪ್ರಾಯೋಗಿಕ ಮಾಹಿತಿ ('ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ' ನೋಡಿ).",

  actions: { SELL_NOW: "ಈಗ ಮಾರಿ", HOLD: "ಕಾಯಿರಿ", SELL_PART: "ಭಾಗಶಃ ಮಾರಿ" },
  actionLong: {
    SELL_NOW: "ಈಗಲೇ ಮಾರಿ",
    HOLD: (date) => `${date} ವರೆಗೆ ಕಾಯಿರಿ`,
    SELL_PART: "ಸುಮಾರು ಅರ್ಧ ಈಗ ಮಾರಿ",
  },
  explain: {
    SELL_NOW: (gain, min) =>
      `ಸಂಗ್ರಹಣೆಯ ನಷ್ಟ ಮತ್ತು ಬಡ್ಡಿ ಲೆಕ್ಕ ಹಾಕಿದರೆ ಕಾಯುವುದರಿಂದ ಲಾಭ ಸಿಗುವ ಸಾಧ್ಯತೆ ಕಡಿಮೆ. ಗರಿಷ್ಠ ನಿರೀಕ್ಷಿತ ಲಾಭ ${gain}, ಕಾಯಲು ಬೇಕಾದ ${min} ಗಿಂತ ಕಡಿಮೆ.`,
    HOLD: (date, gain, prob) =>
      `ಬೆಲೆ ಏರುವ ಸಾಧ್ಯತೆ ಇದೆ. ${date} ರ ವಾರದವರೆಗೆ ಕಾಯ್ದರೆ ವೆಚ್ಚ ಕಳೆದು ಸುಮಾರು ${gain} ಹೆಚ್ಚು ನಿರೀಕ್ಷೆ; ಇಂದಿನ ದರಕ್ಕಿಂತ ಹೆಚ್ಚು ಸಿಗುವ ಸಾಧ್ಯತೆ ${prob}.`,
    SELL_PART: (date, gain, prob) =>
      `${date} ರ ವಾರದೊಳಗೆ ವೆಚ್ಚ ಕಳೆದು ಸುಮಾರು ${gain} ಏರಿಕೆ ಸಾಧ್ಯ, ಆದರೆ ಸಾಧ್ಯತೆ ${prob} ಮಾತ್ರ. ಅರ್ಧದಷ್ಟು ಈಗ ಮಾರಿ, ಉಳಿದದ್ದನ್ನು ಇಟ್ಟುಕೊಂಡರೆ ಅಪಾಯ ಹಂಚಿಹೋಗುತ್ತದೆ.`,
  },
  downside: (loss) =>
    `ಅಪಾಯ: ಕೆಟ್ಟ ಸಂದರ್ಭದಲ್ಲಿ (10ರಲ್ಲಿ 1), ಇಂದು ಮಾರುವುದಕ್ಕಿಂತ ${loss} ಕಡಿಮೆ ಸಿಗಬಹುದು.`,
  noForecast: "ಈ ಮಾರುಕಟ್ಟೆಗೆ ಸದ್ಯಕ್ಕೆ ಮುನ್ಸೂಚನೆ ಲಭ್ಯವಿಲ್ಲ.",
  stale: "ಇತ್ತೀಚೆಗೆ ವಹಿವಾಟು ವರದಿಯಾಗಿಲ್ಲ. ಬೆಲೆ ಹಳೆಯದಾಗಿರಬಹುದು.",

  overview: {
    title: "ಈ ವಾರದ ಅಡಿಕೆ ಧಾರಣೆ",
    intro:
      "ದಕ್ಷಿಣ ಕನ್ನಡದ ಮಾರುಕಟ್ಟೆಗಳ ಇತ್ತೀಚಿನ ಮಾದರಿ ದರ, ಮುಂದಿನ 12 ವಾರಗಳ ಮುನ್ನೋಟ, ಮತ್ತು ದಾಸ್ತಾನು ಇಟ್ಟುಕೊಂಡರೆ ಲಾಭವಾಗಬಹುದೇ ಎಂಬ ಸಲಹೆ.",
    bestPrice: "ಉತ್ತಮ ದರ",
    market: "ಮಾರುಕಟ್ಟೆ",
    price: "ದರ",
    change1w: "1 ವಾರ",
    outlook: "12 ವಾರದ ಮುನ್ನೋಟ",
    signal: "ಸಲಹೆ",
    open: "ವಿವರ",
    seasonTitle: "ಋತುವಿನ ಮಾದರಿ",
    seasonText: (month, pct, peak, peakPct) =>
      `ಹಿಂದಿನ ವರ್ಷಗಳಲ್ಲಿ ${month} ತಿಂಗಳ ದರ ವಾರ್ಷಿಕ ಸರಾಸರಿಗೆ ಹೋಲಿಸಿದರೆ ${pct} ಇತ್ತು. ಸಾಮಾನ್ಯವಾಗಿ ${peak} ತಿಂಗಳಲ್ಲಿ ದರ ಗರಿಷ್ಠ (${peakPct}).`,
    howTitle: "ಸಲಹೆ ಹೇಗೆ ಸಿದ್ಧವಾಗುತ್ತದೆ",
    how: [
      "ಪ್ರತಿ ಮಾರುಕಟ್ಟೆಯ ವಾರದ ದರವನ್ನು 12 ವಾರ ಮುಂಚಿತವಾಗಿ, ಸಂಭಾವ್ಯ ವ್ಯಾಪ್ತಿಯೊಂದಿಗೆ ಅಂದಾಜಿಸುತ್ತೇವೆ.",
      "ಕಾಯುವ ವೆಚ್ಚವನ್ನು ಕಳೆಯುತ್ತೇವೆ: ಸಂಗ್ರಹಣೆಯ ನಷ್ಟ ಮತ್ತು ಇಂದು ಸಿಗಬಹುದಾದ ಹಣದ ಬಡ್ಡಿ.",
      "ಕಾಯುವುದರಿಂದ ಕನಿಷ್ಠ 3% ಹೆಚ್ಚು ಸಿಗುವ ಸಾಧ್ಯತೆ ಇದ್ದರೆ 'ಕಾಯಿರಿ', ಇಲ್ಲದಿದ್ದರೆ 'ಈಗ ಮಾರಿ'.",
    ],
  },

  detail: {
    back: "ಎಲ್ಲಾ ಮಾರುಕಟ್ಟೆಗಳು",
    latest: "ಈ ವಾರದ ದರ",
    lastTrade: (date) => `ಕೊನೆಯ ವಹಿವಾಟು ${date}`,
    range52: "52 ವಾರಗಳ ವ್ಯಾಪ್ತಿ",
    forecast12: "12 ವಾರಗಳ ನಂತರ",
    likelyRange: "ಸಂಭಾವ್ಯ ವ್ಯಾಪ್ತಿ",
    signalTitle: "ಈಗ ಮಾರಲೇ?",
    bestWeek: "ಮಾರಲು ಉತ್ತಮ ವಾರ",
    expectedGain: "ವೆಚ್ಚ ಕಳೆದು ನಿರೀಕ್ಷಿತ ಲಾಭ",
    chance: "ಕಾಯುವುದರಿಂದ ಲಾಭದ ಸಾಧ್ಯತೆ",
    perQtl: "ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್",
    share: "ವಾಟ್ಸ್‌ಆ್ಯಪ್‌ನಲ್ಲಿ ಹಂಚಿ",
    chartTitle: "ದರ ಮತ್ತು 12 ವಾರದ ಮುನ್ಸೂಚನೆ",
    chartSubtitle: "ವಾರದ ಮಧ್ಯಮ ಮಾದರಿ ದರ, ₹/ಕ್ವಿಂಟಾಲ್. ಬಣ್ಣದ ಪಟ್ಟಿ: 80% ಸಂಭಾವ್ಯ ವ್ಯಾಪ್ತಿ.",
    actual: "ನೈಜ ದರ",
    forecast: "ಮುನ್ಸೂಚನೆ",
    band: "80% ವ್ಯಾಪ್ತಿ",
    today: "ಇತ್ತೀಚಿನ",
    showTable: "ಮಾಹಿತಿ ಕೋಷ್ಟಕ ತೋರಿಸಿ",
    week: "ವಾರ",
    low: "ಕಡಿಮೆ (P10)",
    mid: "ನಿರೀಕ್ಷಿತ (P50)",
    high: "ಹೆಚ್ಚು (P90)",
    range: { "1y": "1 ವ", "2y": "2 ವ", "5y": "5 ವ" },
    calcTitle: "ಮಾರಾಟ ಲೆಕ್ಕಾಚಾರ",
    calcIntro: "ನಿಮ್ಮ ದಾಸ್ತಾನು ಮತ್ತು ವೆಚ್ಚ ನಮೂದಿಸಿ. ಸಲಹೆ ತಕ್ಷಣ ಬದಲಾಗುತ್ತದೆ.",
    quantity: "ದಾಸ್ತಾನು (ಕ್ವಿಂಟಾಲ್)",
    storageLoss: "ಸಂಗ್ರಹಣೆ ನಷ್ಟ (% ತಿಂಗಳಿಗೆ)",
    interest: "ಹಣದ ಬಡ್ಡಿ (% ವರ್ಷಕ್ಕೆ)",
    sellNowValue: "ಇಂದೇ ಪೂರ್ತಿ ಮಾರಿದರೆ",
    holdValue: (date) => `${date} ವರೆಗೆ ಕಾಯ್ದರೆ (ನಿರೀಕ್ಷೆ)`,
    splitValue: "ಅರ್ಧ ಈಗ, ಅರ್ಧ ನಂತರ",
    extra: "ವೆಚ್ಚ ಕಳೆದು ಹೆಚ್ಚುವರಿ",
    planTitle: "ವಾರವಾರು ನೋಟ",
    breakEven: "ನಷ್ಟವಿಲ್ಲದ ದರ",
    chanceShort: "ಸಾಧ್ಯತೆ",
    gainShort: "ಲಾಭ/ಕ್ವಿಂ",
    seasonTitle: "ತಿಂಗಳವಾರು ಸಾಮಾನ್ಯ ದರ",
    seasonSubtitle: "ಹಿಂದಿನ ವರ್ಷಗಳ ಸರಾಸರಿ; 0% ಎಂದರೆ ವಾರ್ಷಿಕ ಸರಾಸರಿ.",
    compareTitle: (variety) => `${variety}: ಈ ವಾರ ಇತರ ಮಾರುಕಟ್ಟೆಗಳು`,
    compareSubtitle: "ವಾರದ ಮಧ್ಯಮ ಮಾದರಿ ದರ, ₹/ಕ್ವಿಂಟಾಲ್.",
    thisMarket: "ಈ ಮಾರುಕಟ್ಟೆ",
  },

  accuracy: {
    title: "ಮುನ್ಸೂಚನೆಗಳು ಎಷ್ಟು ನಿಖರ?",
    intro: (origins, from, to) =>
      `ಹಿಂದಿನ ಮಾಹಿತಿಯ ಮೇಲೆ (${from} ರಿಂದ ${to}) ಪ್ರತಿಯೊಂದು ಮಾದರಿಯನ್ನು ${origins} ಬಾರಿ, ಆ ಸಮಯದಲ್ಲಿ ತಿಳಿದಿದ್ದ ಮಾಹಿತಿಯನ್ನು ಮಾತ್ರ ಬಳಸಿ ಓಡಿಸಿ, ನಿಜವಾಗಿ ಆದ ದರದೊಂದಿಗೆ ಹೋಲಿಸಿದ್ದೇವೆ.`,
    demoNote:
      "ಈ ಅಂಕಗಳು ಕೃತಕ ಪ್ರಾಯೋಗಿಕ ಮಾಹಿತಿಯ ಮೇಲೆ ಅಳೆದವು. ವ್ಯವಸ್ಥೆ ಸರಿಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ ಎಂದು ತೋರಿಸುತ್ತವೆ, ನೈಜ ದರಗಳ ನಿಖರತೆಯನ್ನಲ್ಲ. ನೈಜ ಮಾಹಿತಿ ಜೋಡಿಸಿದ ನಂತರ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಮರುಲೆಕ್ಕವಾಗುತ್ತವೆ.",
    ours: "ನಮ್ಮ ಮಾದರಿ: ಸರಾಸರಿ ದೋಷ",
    bestBaseline: (name) => `ಅತ್ಯುತ್ತಮ ಸರಳ ವಿಧಾನ (${name})`,
    direction: "8 ವಾರ ಮುಂಚಿನ ದಿಕ್ಕು ಸರಿ",
    coverage: "ವ್ಯಾಪ್ತಿಯೊಳಗೆ ನೈಜ ದರ",
    coverageTarget: "ಗುರಿ 80%",
    chartTitle: "ಮುನ್ಸೂಚನೆ ಅವಧಿಯ ಪ್ರಕಾರ ಸರಾಸರಿ ದೋಷ",
    chartSubtitle: "ಸರಾಸರಿ ಶೇಕಡಾ ದೋಷ (ಕಡಿಮೆ ಇದ್ದಷ್ಟು ಉತ್ತಮ).",
    weeksAhead: (h) => `${h} ವಾ`,
    model: "ಮಾದರಿ",
    mapeAvg: "ಸರಾಸರಿ ದೋಷ",
    h: (h) => `${h} ವಾರ`,
    dirShort: "ದಿಕ್ಕು",
    shortTermNote:
      "ಒಂದು ವಾರ ಮುಂಚಿತವಾಗಿ ಸರಳ ವಿಧಾನಗಳೂ ಅಷ್ಟೇ ಅಥವಾ ಹೆಚ್ಚು ನಿಖರ: ಒಂದು ವಾರದಲ್ಲಿ ದರ ಹೆಚ್ಚು ಬದಲಾಗುವುದಿಲ್ಲ. ಮಾರಾಟ ನಿರ್ಧಾರಕ್ಕೆ ಬೇಕಾದ 4 ರಿಂದ 12 ವಾರಗಳ ಅವಧಿಯಲ್ಲಿ ನಮ್ಮ ಮಾದರಿ ಉಪಯುಕ್ತ.",
    models: {
      naive: "ದರ ಬದಲಾಗುವುದಿಲ್ಲ",
      seasonal_naive: "ಕಳೆದ ವರ್ಷದಂತೆ",
      arima: "ARIMA (ಹಿಂದಿನ ಅಧ್ಯಯನಗಳಲ್ಲಿ ಬಳಸಿದ್ದು)",
      gbm: "AdikeCast ಮಾದರಿ",
    },
  },

  about: {
    title: "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
  },

  share: {
    header: (market, variety) => `ಅಡಿಕೆ ಧಾರಣೆ: ${market}, ${variety}`,
    latest: (price, date) => `ಈ ವಾರ: ${price}/ಕ್ವಿಂಟಾಲ್ (${date})`,
    forecast: (weeks, price, low, high) =>
      `${weeks} ವಾರಗಳಲ್ಲಿ: ಸುಮಾರು ${price} (ಸಂಭಾವ್ಯ ${low} ರಿಂದ ${high})`,
    signal: (text) => `ಸಲಹೆ: ${text}`,
    footer: "ಇದು ಅಂದಾಜು, ಖಾತರಿಯಲ್ಲ. ವ್ಯಾಪಾರಿಯೊಂದಿಗೆ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, kn };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

const MARKET_NAMES: Record<string, Record<Locale, string>> = {
  Mangalore: { en: "Mangaluru", kn: "ಮಂಗಳೂರು" },
  Bantwala: { en: "Bantwal", kn: "ಬಂಟ್ವಾಳ" },
  Puttur: { en: "Puttur", kn: "ಪುತ್ತೂರು" },
  Sullia: { en: "Sullia", kn: "ಸುಳ್ಯ" },
  Belthangady: { en: "Belthangady", kn: "ಬೆಳ್ತಂಗಡಿ" },
};

const VARIETY_NAMES: Record<string, Record<Locale, string>> = {
  "New Variety": { en: "New chali", kn: "ಹೊಸ ಚಾಲಿ" },
  "Old Variety": { en: "Old chali", kn: "ಹಳೆ ಚಾಲಿ" },
  Coca: { en: "Coca", kn: "ಕೋಕಾ" },
};

export function marketName(market: string, locale: Locale): string {
  return MARKET_NAMES[market]?.[locale] ?? market;
}

export function varietyName(variety: string, locale: Locale): string {
  return VARIETY_NAMES[variety]?.[locale] ?? variety;
}
