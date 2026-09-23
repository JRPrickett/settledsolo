import { expect, test, type Page } from "@playwright/test";

const DAY = 24 * 60 * 60 * 1000;

// Ten saved sessions through the legacy import path, seeded once so reloads keep the imported log.
async function seedHistory(page: Page) {
  await page.addInitScript((day) => {
    if (sessionStorage.getItem("backup-reminder-seeded")) return;
    sessionStorage.setItem("backup-reminder-seeded", "1");
    localStorage.setItem(
      "threshold.v2",
      JSON.stringify({
        version: 5,
        name: "Mabel",
        active: "training",
        setupDone: true,
        scenarios: [
          {
            id: "training",
            label: "Front door",
            start: 12,
            sessions: Array.from({ length: 10 }, (_, index) => ({
              id: `session-${index}`,
              kind: "absence",
              at: Date.now() - (10 - index) * day,
              target: 12 + index,
              actual: 12 + index,
              outcome: "success"
            }))
          }
        ]
      })
    );
  }, DAY);
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
}

test("a local-only log with real history is reminded to back up, and a download clears it", async ({ page }) => {
  await seedHistory(page);
  const reminder = page.getByRole("complementary", { name: "Backup reminder" });
  await expect(reminder).toContainText("10 sessions are saved only on this device");

  const download = page.waitForEvent("download");
  await reminder.getByRole("button", { name: "Download backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/^settledsolo-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(reminder).toBeHidden();
  await expect(page.getByRole("button", { name: "Account & backup" })).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("settledsolo.last-backup-at.v1")))
    .not.toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Backup reminder" })).toHaveCount(0);
});

test("the backup reminder can be snoozed without downloading", async ({ page }) => {
  await seedHistory(page);
  const reminder = page.getByRole("complementary", { name: "Backup reminder" });
  await reminder.getByRole("button", { name: "Remind me later" }).click();
  await expect(reminder).toBeHidden();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("settledsolo.backup-reminder-snoozed-until.v1")))
    .not.toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Backup reminder" })).toHaveCount(0);
});
