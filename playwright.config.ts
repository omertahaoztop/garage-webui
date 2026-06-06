import { defineConfig, devices } from "@playwright/test";

const CHROMIUM =
  process.env.PW_CHROMIUM ||
  `${process.env.HOME}/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3909",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: CHROMIUM },
      },
    },
  ],
});
