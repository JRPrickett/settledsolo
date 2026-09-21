import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

const waiting = "SettledSolo is open in another window.";

test("a second window cannot edit or sync, then reads the latest log after handover", async ({ page, context }) => {
  await completeSetup(page, 5);
  const other = await context.newPage();
  const privateRequests: string[] = [];
  other.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) privateRequests.push(request.url());
  });
  await other.goto("/app/");
  await expect(other.getByRole("heading", { name: waiting })).toBeVisible();
  await other.getByRole("button", { name: "Try this window again" }).click();
  await expect(other.getByRole("heading", { name: waiting })).toBeVisible();
  await expect(other.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
  expect(privateRequests).toEqual([]);

  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Track name", { exact: true }).fill("Latest track name");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dog-training-app.fallback.v1")!).scenarios[0].label)).toBe("Latest track name");
  // Leaving the app releases browser ownership; public pages do not hold it.
  await page.goto("/");
  await other.getByRole("button", { name: "Try this window again" }).click();
  await expect(other.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await expect(other.getByText("Latest track name", { exact: true })).toBeVisible();
  // Back/forward history must not restore a second writable app from a cached page.
  await page.goBack();
  await expect(page.getByRole("heading", { name: waiting })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start today's session" })).toHaveCount(0);
});

test("closing a running session window lets another recover its original timer and save once", async ({ page, context }) => {
  await completeSetup(page, 30);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("dog-training-app.active.fallback.v1");
    return raw ? JSON.parse(raw).state.phase : null;
  })).toBe("running");
  const startedAt = await page.evaluate(() => JSON.parse(localStorage.getItem("dog-training-app.active.fallback.v1")!).state.startedAt);
  const other = await context.newPage();
  await other.goto("/app/");
  await expect(other.getByRole("heading", { name: waiting })).toBeVisible();
  await expect(other.getByRole("button", { name: "I'm back" })).toHaveCount(0);
  await page.close();
  await other.getByRole("button", { name: "Try this window again" }).click();
  await expect(other.getByRole("button", { name: "I'm back" })).toBeVisible();
  expect(await other.evaluate(() => JSON.parse(localStorage.getItem("dog-training-app.active.fallback.v1")!).state.startedAt)).toBe(startedAt);
  await other.getByRole("button", { name: "I'm back" }).click();
  await other.getByRole("button", { name: /Relaxed/ }).click();
  await other.getByRole("button", { name: "Save session" }).click();
  await expect(other.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await other.reload();
  await expect(other.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
  await other.getByRole("button", { name: "History", exact: true }).click();
  await expect(other.getByText("Relaxed", { exact: true })).toHaveCount(1);
});

for (const failure of ["missing", "denied"] as const) {
  test(`locking ${failure} requires explicit single-window confirmation without blocking local training`, async ({ page }) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: mode === "missing" ? undefined : { request: () => Promise.reject(new Error("denied")) }
      });
    }, failure);
    await page.goto("/app/");
    await expect(page.getByRole("heading", { name: "Use one SettledSolo window at a time." })).toBeVisible();
    await expect(page.getByLabel("Your dog's name")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue in this window only" }).click();
    await page.getByLabel("Your dog's name").fill("Mabel");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /^Stays relaxed/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /^Yes/ }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByLabel("Comfortable duration").fill("5");
    await page.getByRole("button", { name: "See my starting plan" }).click();
    await page.getByRole("button", { name: "Use this starting plan" }).click();
    await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  });
}
