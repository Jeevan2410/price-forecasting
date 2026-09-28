import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests run against the production build (`npm run build` first).
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
