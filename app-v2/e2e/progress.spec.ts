import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("progress reflects mixed outcomes and observed signals", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More" }).click();

  const backup = {
    schemaVersion: 1,
    exportedAt: "2026-09-18T00:00:00.000Z",
    appData: {
      dogName: "Mabel",
      activeScenarioId: "training",
      scenarios: [{
        id: "training",
        label: "Home alone",
        startSeconds: 5,
        sessions: [
          {
            id: "mixed-1",
            at: Date.UTC(2026, 8, 10, 12, 0, 0),
            targetSeconds: 20,
            actualSeconds: 20,
            outcome: "relaxed",
            stoppedEarly: false,
            signals: [],
            tags: [],
            stopReason: "",
            note: ""
          },
          {
            id: "mixed-2",
            at: Date.UTC(2026, 8, 11, 12, 0, 0),
            targetSeconds: 30,
            actualSeconds: 25,
            outcome: "concern",
            stoppedEarly: true,
            signals: ["pacing"],
            tags: [],
            stopReason: "Pacing started",
            note: ""
          },
          {
            id: "mixed-3",
            at: Date.UTC(2026, 8, 12, 12, 0, 0),
            targetSeconds: 30,
            actualSeconds: 15,
            outcome: "distressed",
            stoppedEarly: true,
            signals: ["pacing", "whining"],
            tags: [],
            stopReason: "Whining escalated",
            note: ""
          }
        ]
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "progress-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();
  // Restoring ends on Today; wait for it so a later tab switch is not undone.
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await page.getByRole("button", { name: "Progress" }).click();

  const longest = page.locator(".stat-card").filter({ hasText: "Longest relaxed" });
  await expect(longest.getByText("20s", { exact: true })).toBeVisible();

  const recent = page.locator(".stat-card").filter({ hasText: "Recent comfort" });
  await expect(recent.getByText("1/3", { exact: true })).toBeVisible();

  const observations = page.locator(".pattern-card");
  await expect(observations.getByText("Pacing", { exact: true })).toBeVisible();
  await expect(observations.getByText("2 sessions", { exact: true })).toBeVisible();
  await expect(observations.getByText("Whining", { exact: true })).toBeVisible();
  await expect(observations.getByText("1 session", { exact: true })).toBeVisible();
});
