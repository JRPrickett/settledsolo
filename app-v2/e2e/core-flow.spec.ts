import { expect, test } from "@playwright/test";
import type { AppData } from "../src/domain/types";

async function expectNoSub16pxFormControls(
  page: import("@playwright/test").Page
) {
  const controls = page.locator(
    'input:not([type="checkbox"]):not([type="radio"]), select, textarea'
  );
  const tooSmall = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        label:
          element.getAttribute("aria-label") ??
          element.getAttribute("name") ??
          element.getAttribute("placeholder") ??
          "",
        fontSize: Number.parseFloat(window.getComputedStyle(element).fontSize)
      }))
      .filter((control) => control.fontSize < 16)
  );

  expect(tooSmall).toEqual([]);
}

async function completeSetup(page: import("@playwright/test").Page, seconds = 1) {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Comfortable duration").fill(String(seconds));
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
}

test("mobile form controls remain at least 16px to prevent iOS focus zoom", async ({ page }) => {
  await page.goto("/app/");
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
  await expectNoSub16pxFormControls(page);

  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Comfortable duration")).toBeVisible();
  await expectNoSub16pxFormControls(page);

  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await page.getByRole("button", { name: "More" }).click();

  await expect(page.getByRole("heading", { name: /training settings/i })).toBeVisible();
  await expectNoSub16pxFormControls(page);
});

test("setup accepts an observed comfortable duration and converts minutes to seconds", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const duration = page.getByLabel("Comfortable duration");
  await duration.fill("");
  await duration.type("25");
  await expect(duration).toHaveValue("25");

  await duration.fill("1");
  await page.getByLabel("Duration unit").selectOption("minutes");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await expect(page.getByText("1 minute", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByText("1:00")).toBeVisible();
});

test("onboarding routes cue-sensitive dogs to departure-cue practice before leaving", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Gets watchful or follows me/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Start before the leaving part." })).toBeVisible();
  await expect(page.getByText("Departure cues first", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByRole("heading", { name: "Departure cues first" })).toBeVisible();
  await page.getByRole("button", { name: "Start departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();
});

test("onboarding uses a clearly-labelled micro departure when no comfortable absence is known", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^I'm not sure/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Start with a 3-second observation." })).toBeVisible();
  await expect(page.getByText(/conservative SettledSolo heuristic/)).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByText("Starting observation", { exact: true })).toBeVisible();
  await expect(page.getByText("3s")).toBeVisible();
});

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

test("departure cue practice only advances after repeated calm sets", async ({ page }) => {
  await completeSetup(page, 5);

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();

  for (let rep = 0; rep < 3; rep += 1) {
    await page.getByRole("button", { name: /Relaxed/ }).click();
  }
  await page.getByRole("button", { name: "Save cue practice" }).click();

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();

  for (let rep = 0; rep < 3; rep += 1) {
    await page.getByRole("button", { name: /Relaxed/ }).click();
  }
  await page.getByRole("button", { name: "Save cue practice" }).click();

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Stand near the exit for a moment, then move away" })
  ).toBeVisible();
});


test("legacy users keep multiple training tracks after migration", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "threshold.v2",
      JSON.stringify({
        version: 5,
        name: "Mabel",
        active: "evening",
        setupDone: true,
        scenarios: [
          {
            id: "morning",
            label: "Morning routine",
            start: 5,
            sessions: []
          },
          {
            id: "evening",
            label: "Evening routine",
            start: 12,
            sessions: []
          }
        ]
      })
    );
  });

  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await page.getByRole("button", { name: "More" }).click();

  const selector = page.getByLabel("Training track");
  await expect(selector).toHaveValue("evening");
  await selector.selectOption("morning");
  await expect(selector).toHaveValue("morning");

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expect(page.getByText("Morning routine")).toBeVisible();
});


test("danger-zone reset deletes local training state and restarts onboarding", async ({ page }) => {
  await page.addInitScript(() => {
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
            label: "Existing training",
            start: 12,
            sessions: [
              {
                id: "old-session",
                kind: "absence",
                at: Date.now() - 60_000,
                target: 12,
                actual: 12,
                outcome: "success"
              }
            ]
          }
        ]
      })
    );
  });

  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await page.getByRole("button", { name: "More" }).click();

  await page.getByRole("button", { name: "Reset SettledSolo" }).click();
  const confirmation = page.getByLabel("Type RESET to confirm");
  await confirmation.fill("RESET");

  await page
    .getByRole("button", { name: "Delete local data and start over" })
    .click();

  await expect(page.getByLabel("Your dog's name")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
  await expect(page.getByText("Mabel", { exact: true })).toHaveCount(0);
});

test("a validated backup can replace local data after confirmation", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More" }).click();

  const backup = {
    schemaVersion: 1,
    exportedAt: "2026-09-18T00:00:00.000Z",
    appData: {
      dogName: "Ruby",
      activeScenarioId: "training",
      scenarios: [{
        id: "training",
        label: "Home alone",
        startSeconds: 7,
        sessions: [{
          id: "restored-session",
          at: Date.UTC(2026, 8, 18, 12, 0, 0),
          targetSeconds: 7,
          actualSeconds: 7,
          outcome: "relaxed",
          stoppedEarly: false,
          signals: [],
          note: "restored"
        }]
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });

  await expect(page.getByText("Ready to restore Ruby")).toBeVisible();
  await expect(page.getByText(/1 timed session/)).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();

  await expect(page.getByRole("heading", { name: "You & Ruby" })).toBeVisible();
  await expect(page.getByText("Home alone")).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Relaxed")).toBeVisible();
  await expect(page.getByText("target 7s")).toBeVisible();
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


test("public SettledSolo site leads into the PWA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Calm starts with small steps." })).toBeVisible();
  await expect(page.getByText("SettledSolo").first()).toBeVisible();
  await page.getByRole("link", { name: "Start free" }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
});

test("iOS install help demonstrates the current Safari menu flow", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "Safari installation help is only shown on iOS");
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.goto("/");
  await page.getByRole("button", { name: "Install on iPhone" }).click();

  const installDialog = page.getByRole("dialog", { name: "Keep SettledSolo one tap away." });
  await expect(installDialog).toBeVisible();
  await expect(installDialog.getByText("Three dots", { exact: true })).toBeVisible();

  const fit = await installDialog.evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect();
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      viewportHeight: window.innerHeight,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight
    };
  });
  expect(fit.top).toBeGreaterThanOrEqual(0);
  expect(fit.bottom).toBeLessThanOrEqual(fit.viewportHeight + 1);
  expect(fit.scrollHeight).toBeLessThanOrEqual(fit.clientHeight + 1);

  await installDialog.getByRole("button", { name: "Close installation guide" }).click();

  await completeSetup(page, 5);
  await page.getByText("Show me how").click();

  await page.getByRole("button", { name: "Tap Safari's three-dot menu" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByRole("button", { name: "Add to Home Screen", exact: true }).click();

  await expect(page.getByText("Installed. Tap to watch again.")).toBeVisible();
});


test("a user can create and rename a separate training track", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More" }).click();

  await page.getByLabel("New track name").fill("School run");
  await page.getByLabel("New track starting comfort").fill("9");
  await page.getByRole("button", { name: "Add training track" }).click();

  await expect(page.getByLabel("Training track")).toHaveValue(/scenario-/);
  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("School run");

  await page.getByLabel("Track name", { exact: true }).fill("Weekday school run");
  await page.getByRole("button", { name: "Save track changes" }).click();

  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByText("Weekday school run")).toBeVisible();
  await expect(page.getByText("9s")).toBeVisible();
});

test("fallback history and an active session survive IndexedDB becoming available", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("test-enable-indexeddb") !== "yes") {
      Object.defineProperty(window, "indexedDB", { value: undefined });
    }
  });
  await completeSetup(page, 1);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("dog-training-app.active.fallback.v1");
    return raw ? JSON.parse(raw).state.phase : null;
  })).toBe("running");
  const before = await page.evaluate(() => ({
    data: JSON.parse(localStorage.getItem("dog-training-app.fallback.v1")!),
    active: JSON.parse(localStorage.getItem("dog-training-app.active.fallback.v1")!)
  }));
  await page.evaluate(() => localStorage.setItem("test-enable-indexeddb", "yes"));
  await page.reload();
  await expect(page.getByRole("button", { name: "I'm back" })).toBeVisible();
  const recovered = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("dog-training-app", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<AppData>((resolve, reject) => {
        const request = db.transaction("records").objectStore("records").get("app-data");
        request.onsuccess = () => resolve(request.result.value);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
  expect(recovered).toEqual(before.data);
  const restoredStart = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dog-training-app.active.fallback.v1")!).state.startedAt
  );
  expect(restoredStart).toBe(before.active.state.startedAt);
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Relaxed", { exact: true })).toHaveCount(2);
});

test("storage recovery does not resurrect an expired fallback session", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("test-enable-indexeddb") !== "yes") {
      Object.defineProperty(window, "indexedDB", { value: undefined });
    }
  });
  await completeSetup(page, 1);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("dog-training-app.active.fallback.v1");
    return raw ? JSON.parse(raw).state.phase : null;
  })).toBe("running");
  // Leave the app before changing the persisted checkpoint so live effects cannot refresh it.
  await page.goto("/");
  await page.evaluate(() => {
    const key = "dog-training-app.active.fallback.v1";
    const active = JSON.parse(localStorage.getItem(key)!);
    active.savedAt = Date.now() - 13 * 60 * 60 * 1000;
    localStorage.setItem(key, JSON.stringify(active));
    localStorage.setItem("test-enable-indexeddb", "yes");
  });
  await page.goto("/app/");
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I'm back" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("dog-training-app.active.fallback.v1"))).toBeNull();
});
