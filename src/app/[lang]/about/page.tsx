import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section } from "@/components/ui";
import { dashboard, isDemo } from "@/lib/data";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { DEFAULT_PARAMS } from "@/lib/signal";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).about.title } : {};
}

type Block = { title: string; body: string[] };

function content(lang: Locale): Block[] {
  const p = DEFAULT_PARAMS;
  if (lang === "kn") {
    return [
      {
        title: "ಇದು ಏನು ಮಾಡುತ್ತದೆ",
        body: [
          "AdikeCast ದಕ್ಷಿಣ ಕನ್ನಡದ ಐದು ಮಾರುಕಟ್ಟೆಗಳಲ್ಲಿ (ಮಂಗಳೂರು, ಬಂಟ್ವಾಳ, ಪುತ್ತೂರು, ಸುಳ್ಯ, ಬೆಳ್ತಂಗಡಿ) ಹೊಸ ಚಾಲಿ, ಹಳೆ ಚಾಲಿ ಮತ್ತು ಕೋಕಾ ಅಡಿಕೆಯ ವಾರದ ದರವನ್ನು 12 ವಾರ ಮುಂಚಿತವಾಗಿ ಅಂದಾಜಿಸುತ್ತದೆ. ಆ ಅಂದಾಜಿನಿಂದ ಈಗ ಮಾರುವುದೇ ಅಥವಾ ಕಾಯುವುದೇ ಲಾಭ ಎಂದು ಸಲಹೆ ನೀಡುತ್ತದೆ.",
        ],
      },
      {
        title: "ಮಾಹಿತಿ ಮೂಲಗಳು",
        body: [
          "ದರಗಳು: ಕೇಂದ್ರ ಸರ್ಕಾರದ Agmarknet (data.gov.in ಮೂಲಕ). ಮಳೆ: Open-Meteo (ಮಂಗಳೂರು). ಪ್ರತಿದಿನ ಸಂಜೆ 7:30ಕ್ಕೆ ಹೊಸ ಮಾಹಿತಿ ಪಡೆದು ಮಾದರಿಯನ್ನು ಮರುತರಬೇತಿಗೊಳಿಸಲಾಗುತ್ತದೆ.",
          "ಪ್ರತಿ ವಾರದ ದರ ಎಂದರೆ ಆ ವಾರದ ದಿನಗಳ ಮಾದರಿ ದರಗಳ ಮಧ್ಯಮ (median) ಮೌಲ್ಯ.",
        ],
      },
      {
        title: "ಮುನ್ಸೂಚನೆ ಹೇಗೆ",
        body: [
          "ಎಲ್ಲಾ ಮಾರುಕಟ್ಟೆ ಮತ್ತು ತಳಿಗಳ ಮಾಹಿತಿಯನ್ನು ಒಟ್ಟಿಗೆ ಬಳಸುವ gradient boosting ಮಾದರಿ: ಇತ್ತೀಚಿನ ದರ ಬದಲಾವಣೆ, ಕಳೆದ ವರ್ಷ ಇದೇ ಅವಧಿಯ ಏರಿಳಿತ, ಋತು, ಮಳೆ ಮತ್ತು ಆವಕ.",
          "ಪ್ರತಿ ವಾರಕ್ಕೆ ಕಡಿಮೆ (P10), ನಿರೀಕ್ಷಿತ (P50) ಮತ್ತು ಹೆಚ್ಚು (P90) ದರ ಅಂದಾಜು. ಹಿಂದಿನ ತಪ್ಪುಗಳ ಆಧಾರದ ಮೇಲೆ ವ್ಯಾಪ್ತಿಯನ್ನು ಸರಿಪಡಿಸಲಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ 10ರಲ್ಲಿ ಸುಮಾರು 8 ಬಾರಿ ನೈಜ ದರ ಆ ವ್ಯಾಪ್ತಿಯೊಳಗೆ ಬರುತ್ತದೆ.",
        ],
      },
      {
        title: "ಮಾರಾಟ ಸಲಹೆ",
        body: [
          `ಕಾಯುವ ವೆಚ್ಚ: ಸಂಗ್ರಹಣೆ ನಷ್ಟ (ತಿಂಗಳಿಗೆ ${p.storageLossPctPerMonth}%) ಮತ್ತು ಬಡ್ಡಿ (ವರ್ಷಕ್ಕೆ ${p.interestPctPerYear}%). ಲೆಕ್ಕಾಚಾರದಲ್ಲಿ ನಿಮ್ಮ ಸ್ವಂತ ವೆಚ್ಚ ನಮೂದಿಸಬಹುದು.`,
          `ವೆಚ್ಚ ಕಳೆದು ಕನಿಷ್ಠ ${p.minGainPct}% ಹೆಚ್ಚು ಸಿಗುವ ಸಾಧ್ಯತೆ ${Math.round(p.holdConfidence * 100)}% ಅಥವಾ ಹೆಚ್ಚು ಇದ್ದರೆ 'ಕಾಯಿರಿ'. ಲಾಭ ಸಾಧ್ಯ ಆದರೆ ಖಚಿತವಿಲ್ಲದಿದ್ದರೆ 'ಭಾಗಶಃ ಮಾರಿ'. ಇಲ್ಲದಿದ್ದರೆ 'ಈಗ ಮಾರಿ'.`,
        ],
      },
      {
        title: "ಮಿತಿಗಳು",
        body: [
          "ಇದು ಅಂದಾಜು ಮಾತ್ರ. ಗುಣಮಟ್ಟ, ತೇವಾಂಶ ಮತ್ತು ವ್ಯಾಪಾರಿಯನ್ನು ಅವಲಂಬಿಸಿ ನಿಮಗೆ ಸಿಗುವ ದರ ಬೇರೆ ಇರಬಹುದು. ನೀತಿ ಬದಲಾವಣೆ ಅಥವಾ ಆಮದು ಸುದ್ದಿಯಂತಹ ಅನಿರೀಕ್ಷಿತ ಘಟನೆಗಳನ್ನು ಮಾದರಿ ಊಹಿಸಲಾರದು.",
        ],
      },
    ];
  }
  return [
    {
      title: "What it does",
      body: [
        "AdikeCast forecasts the weekly arecanut price 12 weeks ahead for New Variety (hosa chali), Old Variety (hale chali) and Coca in five Dakshina Kannada mandis: Mangaluru, Bantwal, Puttur, Sullia and Belthangady. It turns the forecast into a plain sell-or-hold signal for a farmer holding dried nuts.",
      ],
    },
    {
      title: "Data",
      body: [
        "Prices: Agmarknet, via the Government of India open data API (data.gov.in), plus historical Agmarknet or CEDA exports for backfill. Rainfall: Open-Meteo historical weather for Mangaluru. A scheduled job fetches new data every evening at 19:30 IST, retrains, and republishes the site.",
        "The weekly price is the median of the week's daily modal prices, which dampens single-day outliers. Gaps of up to three weeks are carried forward; longer gaps stay empty and the market is flagged as stale.",
      ],
    },
    {
      title: "The forecast",
      body: [
        "One gradient-boosted tree model is trained on all markets and varieties together. It predicts the log change in price over 1 to 12 weeks from recent price moves and volatility, how the price moved over the same weeks in the last two years, the time of year, rainfall against its usual level, and arrivals where available.",
        "The model predicts three quantiles (P10, P50, P90). Their spread is then calibrated with conformal prediction on past errors, so the shaded range contains the real outcome about 80% of the time. The Accuracy page shows how it compares with ARIMA and two simple baselines on data it had not seen.",
      ],
    },
    {
      title: "The sell signal",
      body: [
        `Waiting costs money. By default we assume ${p.storageLossPctPerMonth}% of the stock is lost per month in storage and ${p.interestPctPerYear}% a year interest on the cash you could have today. The calculator lets you enter your own numbers.`,
        `For each week ahead we compute the net gain of waiting and the probability that it beats selling today. If the best week's expected gain is below ${p.minGainPct}%, the signal is Sell now. If it is above and the probability is at least ${Math.round(p.holdConfidence * 100)}%, it is Hold. Otherwise it is Sell part: sell about half now and hold the rest.`,
      ],
    },
    {
      title: "Limits",
      body: [
        "Forecasts are estimates. Your price depends on quality, moisture and the buyer. The model cannot foresee sudden shocks such as import policy changes or pest outbreaks, so always confirm the day's rate before selling.",
        "The Kannada text was drafted for this project and is awaiting review by a native speaker from the district.",
      ],
    },
  ];
}

const API = [
  { path: "/api/v1/series", desc: "Every market × variety with its latest price, weekly change and default signal." },
  { path: "/api/v1/series/mangalore--new-variety", desc: "Full weekly history, 12-week forecast (P10/P50/P90) and seasonality for one series." },
  {
    path: "/api/v1/signal/mangalore--new-variety?storageLoss=0.5&interest=12&quantity=20",
    desc: "Sell/hold signal with your own holding costs, plus the revenue plan for a quantity in quintals.",
  },
  { path: "/api/v1/alert/mangalore--new-variety?lang=kn", desc: "Ready-to-send WhatsApp text (en or kn), for bots and group admins." },
];

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <div className="grid gap-6 pt-6 sm:pt-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.about.title}</h1>
      {isDemo && (
        <p role="note" className="max-w-3xl rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm">
          {t.demoBanner}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {content(lang).map((b) => (
          <Section key={b.title} title={b.title}>
            <div className="grid gap-3 text-ink-2">
              {b.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </Section>
        ))}
      </div>
      <Section title="JSON API" subtitle={`Free, read-only, CORS-enabled. Model: ${dashboard.meta.model}.`}>
        <ul className="grid gap-4">
          {API.map((a) => (
            <li key={a.path}>
              <a href={a.path} className="break-all font-mono text-sm text-accent underline">
                GET {a.path}
              </a>
              <p className="mt-0.5 text-sm text-ink-2">{a.desc}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
