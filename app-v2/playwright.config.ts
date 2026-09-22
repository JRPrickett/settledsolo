import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../test-results/browser",
  testIgnore: ["pwa-offline.spec.ts", "csp.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // Shared startup faults should fail the gate without burning the whole suite.
  maxFailures: process.env.CI ? 5 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium-android",
      use: {
        ...devices["Pixel 7"]
      }
    },
    {
      name: "webkit-iphone",
      use: {
        ...devices["iPhone 15"]
      }
    }
  ],
  webServer: {
    command: "npm run dev:v2 -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    // Exercise the configured feedback path with a non-routable placeholder inbox.
    env: { VITE_CONTACT_EMAIL: "beta-feedback@example.test" },
    reuseExistingServer: !process.env.CI
  }
});
