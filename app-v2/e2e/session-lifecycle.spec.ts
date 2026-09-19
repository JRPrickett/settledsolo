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
  });

  await completeSetup(page, 1);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Enable system alerts" }).click();

  await expect(
    page.getByText("System alerts are blocked in this browser")
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
