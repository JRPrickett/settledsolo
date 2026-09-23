import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("a render failure offers a saved-data backup and reload recovers the app", async ({ page }) => {
  // Read the actual download content in both engines without depending on a native save dialog.
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = value => {
      if (value instanceof Blob) void value.text().then(text => {
        document.documentElement.dataset.backup = text;
      });
      return original(value);
    };
  });
  await completeSetup(page, 5);

  // Seed one saved session so History has something to render.
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
        id: "kept-session", at: Date.now() - 60_000,
        targetSeconds: 5, actualSeconds: 5, outcome: "relaxed",
        stoppedEarly: false, signals: [], tags: [], stopReason: "", note: "Survives a crash"
      }];
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();

  // Force a deterministic render failure on the next screen.
  await page.evaluate(() => {
    Date.prototype.toLocaleDateString = () => {
      throw new Error("Simulated render failure");
    };
  });
  await page.getByRole("button", { name: "History", exact: true }).click();

  const alert = page.getByRole("alert");
  await expect(alert.getByText("Something went wrong")).toBeVisible();
  await alert.getByRole("button", { name: "Download a backup first" }).click();
  await expect(alert.getByText(/Backup downloaded/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.backup ?? ""))
    .toContain("Survives a crash");

  // The simulated fault is page-local, so reloading models a successful recovery.
  await alert.getByRole("button", { name: "Reload app" }).click();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Survives a crash")).toBeVisible();
});

test("the public site error screen does not offer an app backup", async ({ page }) => {
  await page.addInitScript(() => {
    // Break rendering before the public page mounts.
    Object.defineProperty(document, "title", {
      configurable: true,
      set() { throw new Error("Simulated public render failure"); },
      get() { return ""; }
    });
  });
  await page.goto("/privacy");
  await expect(page.getByRole("alert").getByText("Something went wrong")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download a backup first" })).toHaveCount(0);
});
