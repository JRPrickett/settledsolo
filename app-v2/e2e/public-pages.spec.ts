import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("an unknown public address shows a not-found page that is not indexed", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "This page is not here." })).toBeVisible();
  await expect(page).toHaveTitle("Page not found — SettledSolo");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Open SettledSolo" }).click();
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
});

test("contact page offers feedback and self-service data routes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { name: "Tell us what would make training calmer." })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
  const email = page.getByRole("link", { name: "Email feedback" });
  await expect(email).toHaveAttribute("href", /^mailto:beta-feedback@example\.test\?subject=/);
  await expect(page.getByText("Please do not send training records")).toBeVisible();
});

test("More links to help and prefills feedback without training data", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More", exact: true }).click();
  const card = page.getByRole("region", { name: "Stuck, unsure or something broke?" });
  await expect(card.getByRole("link", { name: "Training help" })).toHaveAttribute("href", "/help");
  await expect(card.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(card.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  const href = await card.getByRole("link", { name: "Send feedback" }).getAttribute("href");
  expect(href).toMatch(/^mailto:beta-feedback@example\.test\?/);
  const body = decodeURIComponent(href!.split("body=")[1]);
  expect(body).toContain("App mode: browser tab");
  expect(body).not.toContain("Mabel");
});

test("terms explain the app's safety scope and payment basics", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "A training aid, not a diagnosis." })).toBeVisible();
  await expect(page.getByText(/whether payment is one-off or recurring/i)).toBeVisible();
  await expect(page.getByText(/consumer rights remain unchanged/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
});

test("imported HTML-like text is shown as text and never executes", async ({ page }) => {
  await completeSetup(page, 5);
  // Short enough to survive the dog-name length limit intact.
  const payload = "<img src=x onerror=__injected=1>";
  await page.evaluate(async (text) => {
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
      record.value.dogName = text;
      record.value.scenarios[0].label = text;
      record.value.scenarios[0].sessions = [{
        id: "html-like", at: Date.now() - 60_000,
        targetSeconds: 5, actualSeconds: 5, outcome: "relaxed",
        stoppedEarly: false, signals: [], tags: [], stopReason: "", note: text
      }];
      store.put(record);
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, payload);
  await page.reload();

  await expect(page.locator(".dog-chip")).toHaveText(payload);
  // Long unbroken owner text must wrap rather than widen the mobile layout.
  const fitsViewport = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await fitsViewport()).toBe(true);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText(payload).first()).toBeVisible();
  expect(await fitsViewport()).toBe(true);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __injected?: number }).__injected)).toBeUndefined();
});
