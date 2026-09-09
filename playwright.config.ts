import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-tr",
      use: {
        ...devices["Desktop Chrome"],
        locale: "tr-TR",
        timezoneId: "Europe/Istanbul",
      },
    },
    {
      name: "firefox-us",
      use: {
        ...devices["Desktop Firefox"],
        locale: "en-US",
        timezoneId: "America/Los_Angeles",
      },
    },
    {
      name: "webkit-de",
      use: {
        ...devices["Desktop Safari"],
        locale: "de-DE",
        timezoneId: "Pacific/Auckland",
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        locale: "fr-FR",
        timezoneId: "Europe/Paris",
      },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
