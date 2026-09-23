import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("first session can be completed and appears in history", async ({ page }) => {
  await completeSetup(page, 1);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await expect(page.getByText("Today's main departure")).toBeVisible();

  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(page.getByRole("heading", { name: "How was Mabel while you were away?" })).toBeVisible();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Relaxed")).toBeVisible();
  await expect(page.getByText("target 1s")).toBeVisible();
});

test("a warm-up concern stops the session before the main departure", async ({ page }) => {
  await completeSetup(page, 30);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await expect(page.getByText(/Practice 1 of/)).toBeVisible();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(
    page.getByRole("heading", { name: "How did Mabel stay?" })
  ).toBeVisible();
  await page.getByRole("button", { name: /Some concern/ }).click();

  await expect(
    page.getByRole("heading", { name: "That warm-up was enough for today." })
  ).toBeVisible();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Some concern", { exact: true })).toBeVisible();
});

test("warm-up return control stays visible after the target on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await completeSetup(page, 8);

  await page.getByRole("button", { name: "More" }).click();
  await page.getByLabel("Warm-up count").fill("1");
  await page.getByLabel("Suggested settle time").fill("0");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await expect(page.getByText(/Practice 1 of/)).toBeVisible();

  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const returnButton = page.getByRole("button", { name: "I'm back" });
  await expect(returnButton).toBeVisible();
  await page.waitForTimeout(3_300);
  await expect(page.getByText("Target reached")).toBeVisible();
  await expect(returnButton).toBeInViewport();
});

test("a running session survives a reload and keeps its original timer", async ({ page }) => {
  await completeSetup(page, 5);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(600);

  await page.reload();

  await expect(page.getByRole("button", { name: "I'm back" })).toBeVisible();
  await expect(page.getByText(/away · target 5s/)).toBeVisible();
});

test("a recovered review saves exactly once even if save is tapped twice", async ({ page }) => {
  await completeSetup(page, 1);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" })
  ).toBeVisible();

  // Prove the review state itself survives an interruption before saving.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" })
  ).toBeVisible();

  await page.getByRole("button", { name: /Relaxed/ }).click();
  const save = page.getByRole("button", { name: "Save session" });

  // Simulate a fast double tap in one browser task. The in-flight guard must
  // allow only one TrainingSession to be created.
  await save.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(
    page.getByRole("button", { name: "Start today's session" })
  ).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("target 1s")).toHaveCount(1);

  // The single saved record must remain single after a full app reload too.
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("target 1s")).toHaveCount(1);
});

test("denying system alerts does not block training or repeatedly prompt", async ({ page }) => {
  await page.addInitScript(() => {
    let permission: NotificationPermission = "default";

    Object.defineProperty(window, "__settledsoloNotificationRequests", {
      configurable: true,
      writable: true,
      value: 0
    });

    class MockNotification {
      static get permission(): NotificationPermission {
        return permission;
      }

      static async requestPermission(): Promise<NotificationPermission> {
        const state = window as typeof window & {
          __settledsoloNotificationRequests: number;
        };
        state.__settledsoloNotificationRequests += 1;
        permission = "denied";
        return permission;
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class MockPushManager {}
    });
  });

  await completeSetup(page, 1);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Enable return alerts" }).click();

  await expect(
    page.getByText("Return alerts are blocked in this browser")
  ).toBeVisible();

  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __settledsoloNotificationRequests: number;
        }).__settledsoloNotificationRequests
    )
  ).toBe(1);

  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();

  await expect(page.getByRole("button", { name: "I'm back" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __settledsoloNotificationRequests: number;
        }).__settledsoloNotificationRequests
    )
  ).toBe(1);
});

test("a running session remains usable after the browser goes offline", async ({ page, context }) => {
  await completeSetup(page, 2);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await context.setOffline(true);

  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" })
  ).toBeVisible();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
});

test("returning early while relaxed makes the next plan easier without treating it as failure", async ({ page }) => {
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
            id: "relaxed-1",
            at: Date.UTC(2026, 8, 10, 12, 0, 0),
            targetSeconds: 5,
            actualSeconds: 5,
            outcome: "relaxed",
            stoppedEarly: false,
            signals: [],
            tags: [],
            stopReason: "",
            note: ""
          },
          {
            id: "relaxed-2",
            at: Date.UTC(2026, 8, 11, 12, 0, 0),
            targetSeconds: 5,
            actualSeconds: 5,
            outcome: "relaxed",
            stoppedEarly: false,
            signals: [],
            tags: [],
            stopReason: "",
            note: ""
          }
        ]
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();

  await expect(page.getByText("6s").first()).toBeVisible();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await expect(page.getByText("5s").first()).toBeVisible();
  await expect(page.getByText("Repeat", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/returned early while things were still relaxed/)
  ).toBeVisible();
});

test("an unanswered notification prompt never delays the departure timer", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "iOS Safari tabs do not prompt from the departure tap");
  await page.addInitScript(() => {
    // Model an owner who walks out while the browser prompt is still open.
    class PendingNotification {
      static permission = "default";
      static requestPermission() {
        return new Promise(() => {});
      }
    }
    Object.defineProperty(window, "Notification", { configurable: true, value: PendingNotification });
  });
  await completeSetup(page, 5);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect(page.getByRole("button", { name: "I'm back" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "I'm back" })).toBeVisible();
  await expect(page.getByText(/away · target 5s/)).toBeVisible();
});

test("ending a session after a real departure asks before discarding it", async ({ page }) => {
  await completeSetup(page, 5);

  // Nothing has happened yet: an accidental start closes in one tap.
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Mabel has already been left during this session." })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep this session" })).toBeFocused();

  // Keeping returns to the still-running departure with its original timer.
  await dialog.getByRole("button", { name: "Keep this session" }).click();
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Back to the review" }).click();
  await expect(page.getByRole("button", { name: "Save session" })).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Your first completed session will appear here.")).toBeVisible();
});
