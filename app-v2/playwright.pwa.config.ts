import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../test-results/pwa",
  testMatch: ["pwa-offline.spec.ts", "csp.spec.ts"],
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium-pwa",
      use: {
        ...devices["Pixel 7"]
      }
    },
    {
      name: "webkit-pwa",
      use: {
        ...devices["iPhone 15"]
      }
    }
  ],
  webServer: {
    command:
      "npm run build:v2 && npx vite preview --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI
  }
});
