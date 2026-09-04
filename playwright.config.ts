import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3107",
    trace: "on-first-retry",
  },
  projects: [
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    { name: "ios-webkit", use: { ...devices["iPhone 13"] } },
    { name: "small-mobile", use: { ...devices["Galaxy S9+"], viewport: { width: 320, height: 640 } } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm start -- --port 3107",
    url: "http://localhost:3107",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
