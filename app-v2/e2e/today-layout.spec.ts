import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function restoreSessions(page: import("@playwright/test").Page, count: number, tracks = 1) {
  const sessions = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    at: Date.now() - (count - index) * DAY,
    targetSeconds: 30,
    actualSeconds: 30,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: ""
  }));
  const scenarios = [{ id: "training", label: "Front door", startSeconds: 30, sessions }];
  if (tracks > 1) scenarios.push({ id: "evening", label: "Evening", startSeconds: 10, sessions: [] });

  await page.getByRole("button", { name: "More" }).click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "today.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        appData: { dogName: "Mabel", activeScenarioId: "training", scenarios }
      })
    )
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
}

test("a new track shows the full guidance; an established one collapses it to a line", async ({ page }) => {
  await completeSetup(page, 30);
  await expect(page.getByRole("heading", { name: "Cover real absences, not just training sessions." })).toBeVisible();
  // One routine: the track card adds nothing yet.
  await expect(page.getByText("Your training track")).toBeHidden();

  await restoreSessions(page, 5);
  await expect(page.getByRole("heading", { name: "Cover real absences, not just training sessions." })).toBeHidden();
  const coverage = page.getByText("Cover real absences while you train", { exact: true });
  await expect(coverage).toBeVisible();
  await expect(page.getByText("A dog walker for a midday break")).toBeHidden();
  await coverage.click();
  await expect(page.getByText("A dog walker for a midday break")).toBeVisible();

  // Actions stay one tap away.
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Account & backup" })).toBeVisible();
});

test("the track card appears once there is more than one routine", async ({ page }) => {
  await completeSetup(page, 30);
  await restoreSessions(page, 2, 2);
  await expect(page.getByText("Your training track")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Front door" })).toBeVisible();
});

test("the one-time observation keeps its safety rule visible and its detail one tap away", async ({ page }) => {
  await completeSetup(page, 1, false);
  await expect(page.getByRole("heading", { name: "Observe one known-safe absence" })).toBeVisible();
  await expect(page.getByText("Only use an absence you already know is safe.")).toBeVisible();
  await expect(page.getByText("Never extend it to find a limit.")).toBeVisible();
  await expect(page.getByText(/No camera\? Step outside/)).toBeHidden();
  await page.getByText("How to do it", { exact: true }).click();
  await expect(page.getByText(/No camera\? Step outside/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip this step" })).toBeVisible();
});
