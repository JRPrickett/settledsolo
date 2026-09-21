import { expect, test } from "@playwright/test";
import type { AppData } from "../src/domain/types";
import { completeSetup } from "./helpers";

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
  test.slow();
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
  await expect(page.getByText(/2 main departures logged today/)).toBeVisible();
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
