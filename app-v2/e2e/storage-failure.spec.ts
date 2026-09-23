import { expect, test } from "@playwright/test";
import type { AppData } from "../src/domain/types";
import { completeSetup } from "./helpers";

// Read the actual download content in both engines without depending on a native save dialog.
async function captureBackups(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = value => {
      if (value instanceof Blob) void value.text().then(text => {
        document.documentElement.dataset.backup = text;
      });
      return original(value);
    };
  });
}

test("a later IndexedDB failure preserves loaded history and account ownership", async ({ page }) => {
  await captureBackups(page);
  await completeSetup(page, 5);
  await page.goto("/");
  // Model an older fallback from a previous visit; IndexedDB is the authoritative store.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("dog-training-app", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("records", "readwrite");
    const store = transaction.objectStore("records");
    const request = store.get("app-data");
    request.onsuccess = () => {
      const record = request.result;
      record.value.scenarios[0].sessions = [{
        id: "existing-session", at: Date.now() - 60_000,
        targetSeconds: 5, actualSeconds: 5, outcome: "relaxed",
        stoppedEarly: false, signals: [], tags: [], stopReason: "", note: "Keep this history"
      }];
      record.value.sync = {
        accountId: "original-owner", enabled: false, cursor: 42,
        shadow: {}, remote: {}, outbox: [], conflicts: [], archive: []
      };
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    const fallback = JSON.parse(localStorage.getItem("dog-training-app.fallback.v1")!);
    fallback.dogName = "Old snapshot";
    localStorage.setItem("dog-training-app.fallback.v1", JSON.stringify(fallback));
  });
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await page.evaluate(() => {
    indexedDB.open = () => { throw new Error("Simulated storage failure"); };
  });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Track name", { exact: true }).fill("Renamed after storage failure");
  await page.getByRole("button", { name: "Save track changes" }).click();
  const notice = page.getByRole("status", { name: "Storage recovery" });
  await expect(notice).toContainText("Using compatibility storage");
  await notice.getByRole("button", { name: "Back up saved training" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.backup)).toBeTruthy();
  const backup = JSON.parse(await page.evaluate(() => document.documentElement.dataset.backup!));
  expect(backup.appData.dogName).toBe("Mabel");
  expect(backup.appData.scenarios[0].sessions[0].id).toBe("existing-session");
  expect(backup.appData.scenarios[0].label).toBe("Renamed after storage failure");
  // A backup excludes auth/sync ownership; internal fallback must retain it.
  expect(backup.appData.sync).toBeUndefined();
  const fallback: AppData = await page.evaluate(() => JSON.parse(localStorage.getItem("dog-training-app.fallback.v1")!));
  expect(fallback.sync?.accountId).toBe("original-owner");
  expect(fallback.sync?.cursor).toBe(42);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(notice).toBeVisible();
  await expect(page.getByText("Keep this history")).toBeVisible();
});

test("checkpoint storage failure warns during training and the saved session can be backed up", async ({ page }) => {
  await captureBackups(page);
  await completeSetup(page, 1);
  // Only active-checkpoint persistence will run before the warning appears.
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.evaluate(() => {
    indexedDB.open = () => { throw new Error("Simulated storage failure"); };
    Storage.prototype.setItem = () => { throw new Error("Simulated full storage"); };
  });
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const notice = page.getByRole("status", { name: "Storage recovery" });
  await expect(notice).toContainText("progress is only in memory");
  await expect(notice).toContainText("Finish and save your session");
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await expect(notice).not.toContainText("Finish and save your session");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Back up saved training" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.backup)).toBeTruthy();
  const backup = JSON.parse(await page.evaluate(() => document.documentElement.dataset.backup!));
  expect(backup.appData.scenarios[0].sessions).toHaveLength(1);
  expect(backup.appData.scenarios[0].sessions[0].outcome).toBe("relaxed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("changes saved while IndexedDB was failing survive a reload once it recovers", async ({ page }) => {
  await completeSetup(page, 5);
  // IndexedDB fails for the rest of this page, so the change reaches only the fallback.
  await page.evaluate(() => {
    indexedDB.open = () => { throw new Error("Simulated storage failure"); };
  });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Track name", { exact: true }).fill("Renamed while storage failed");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await expect(page.getByRole("status", { name: "Storage recovery" })).toContainText("Using compatibility storage");

  // A fresh page has working IndexedDB again, still holding the older record.
  await page.reload();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("Renamed while storage failed");

  // The newer copy is promoted back into IndexedDB, so it also survives a second reload.
  await page.reload();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("Renamed while storage failed");
});
