import { expect, test } from "@playwright/test";

test("root redirects to the English overview with every market", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Adike prices this week");
  // 5 markets x 3 varieties, each with a signal badge.
  const marketRows = page.locator("tbody tr").filter({ has: page.getByRole("rowheader") });
  await expect(marketRows).toHaveCount(15);
  await expect(marketRows.getByText(/Sell now|Hold|Sell part/)).toHaveCount(15);
});

test("market page: chart, signal and a live calculator", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Mangaluru", exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/market\/mangalore--/);
  await expect(page.getByRole("img", { name: /Price and 12-week forecast/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Should I sell?" })).toBeVisible();

  const sellToday = page.locator("dt", { hasText: "Sell everything today" }).locator("xpath=following-sibling::dd");
  const before = await sellToday.innerText();
  await page.getByLabel("Stock (quintals)").fill("20");
  await expect(sellToday).not.toHaveText(before);
  const value = (s: string) => Number(s.replace(/[^\d]/g, ""));
  expect(value(await sellToday.innerText())).toBe(value(before) * 2);

  const share = page.getByRole("link", { name: "Share on WhatsApp" });
  await expect(share).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
});

test("language switch keeps the page and translates it", async ({ page }) => {
  await page.goto("/en/accuracy");
  await page.getByRole("link", { name: "ಕನ್ನಡ" }).click();
  await expect(page).toHaveURL(/\/kn\/accuracy$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "kn");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ಮುನ್ಸೂಚನೆಗಳು ಎಷ್ಟು ನಿಖರ?");
});

test("accuracy page compares all four models", async ({ page }) => {
  await page.goto("/en/accuracy");
  await expect(page.locator("table tbody tr")).toHaveCount(4);
});

test("no horizontal scrolling on any page", async ({ page }) => {
  for (const path of ["/en", "/kn", "/en/market/puttur--coca", "/en/accuracy", "/kn/about"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("JSON API: signal with custom costs, validation and 404", async ({ request }) => {
  const ok = await request.get("/api/v1/signal/mangalore--new-variety?interest=0&storageLoss=0&quantity=10");
  expect(ok.ok()).toBe(true);
  const body = await ok.json();
  expect(["SELL_NOW", "HOLD", "SELL_PART"]).toContain(body.signal.action);
  expect(body.signal.params.interestPctPerYear).toBe(0);
  expect(body.plan.now).toBe(body.signal.current * 10);

  expect((await request.get("/api/v1/signal/mangalore--new-variety?interest=-1")).status()).toBe(400);
  expect((await request.get("/api/v1/series/nowhere--nothing")).status()).toBe(404);

  const alert = await (await request.get("/api/v1/alert/puttur--coca?lang=kn")).json();
  expect(alert.text).toMatch(/[ಀ-೿]/);
});
