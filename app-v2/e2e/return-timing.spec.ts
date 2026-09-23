import { expect, test, type Page } from "@playwright/test";
import { completeSetup } from "./helpers";

// A fake clock lets these journeys cover minutes of departure time instantly.
async function mainDepartureOnly(page: Page, targetSeconds: number) {
  await page.clock.install();
  await completeSetup(page, targetSeconds);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Warm-up count").fill("0");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
}

test("the reminder asks the owner to head back before the target, and returning in that window is on target", async ({ page }) => {
  // Default walk-back time is 30 seconds.
  await mainDepartureOnly(page, 120);
  await expect(page.getByText("Time remaining")).toBeVisible();

  await page.clock.fastForward(91_000);
  await expect(page.getByText("Time to head back")).toBeVisible();

  await page.clock.fastForward(9_000);
  await page.getByRole("button", { name: "I'm back" }).click();
  // Back at 1:40 of 2:00, inside the 30-second window: not an early return.
  await expect(page.locator(".review-time")).toHaveText("1:40");
  await expect(page.getByText("Why did you come back early?")).toHaveCount(0);
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  // Credited as the full 2:00 target: 10s, 15s, 30s, 1 min and 2 min.
  await expect(page.getByRole("heading", { name: "5 of 20 earned" })).toBeVisible();
  await expect(page.getByText("Longest relaxed absence so far: 2:00.")).toBeVisible();
});

test("a walk-back setting of 'At the target' keeps the old timing", async ({ page }) => {
  await completeSetup(page, 120);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Remind me to head back").selectOption({ label: "At the target" });
  await page.reload();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByLabel("Remind me to head back")).toHaveValue("0");

  await page.clock.install();
  await page.getByLabel("Warm-up count").fill("0");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.clock.fastForward(100_000);
  await expect(page.getByText("Time remaining")).toBeVisible();
  await expect(page.getByText("Time to head back")).toHaveCount(0);
  await page.getByRole("button", { name: "I'm back" }).click();
  await expect(page.getByText("Why did you come back early?")).toBeVisible();
});

test("a late 'I'm back' tap can be recorded as on time before saving", async ({ page }) => {
  await mainDepartureOnly(page, 60);
  await page.clock.fastForward(5 * 60_000);
  await page.getByRole("button", { name: "I'm back" }).click();

  const note = page.getByRole("note");
  await expect(note).toContainText("The timer ran 4:00 past the 1:00 target.");
  await note.getByRole("button", { name: "I was back on time" }).click();
  await expect(page.locator(".review-time")).toHaveText("1:00");
  await expect(note).toContainText("Recorded as the 1:00 target.");

  // Undo restores the measured time; redo, then prove the choice survives a reload.
  await note.getByRole("button", { name: "Keep the timer's 5:00 instead" }).click();
  await expect(page.locator(".review-time")).toHaveText("5:00");
  await note.getByRole("button", { name: "I was back on time" }).click();
  await page.reload();
  await expect(page.locator(".review-time")).toHaveText("1:00");

  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("1:00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("5:00", { exact: true })).toHaveCount(0);
});

test("a modest overrun does not nag", async ({ page }) => {
  await mainDepartureOnly(page, 60);
  await page.clock.fastForward(75_000);
  await page.getByRole("button", { name: "I'm back" }).click();
  await expect(page.locator(".review-time")).toHaveText("1:15");
  await expect(page.getByRole("note")).toHaveCount(0);
});
