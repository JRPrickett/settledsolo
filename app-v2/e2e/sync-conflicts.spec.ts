import { expect, test, type Browser, type Page } from "@playwright/test";
import { cloud, setup, signIn } from "./accountHelpers";

type Cloud = ReturnType<typeof cloud>;

/** Device A creates, uploads and syncs one relaxed session. */
async function firstDeviceWithSession(page: Page, server: Cloud) {
  await server.attach(page.context());
  await setup(page);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await signIn(page);
  await page.getByRole("button", { name: "Connect and upload this log" }).click();
  await expect(page.getByText(/Last synced/)).toBeVisible();
}

/** Device B signs in on a fresh browser profile and restores the account log. */
async function secondDevice(browser: Browser, server: Cloud) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
  await server.attach(context);
  const page = await context.newPage();
  await page.goto("/app/");
  await page.getByRole("button", { name: "Sign in or create a free account" }).click();
  await signIn(page);
  await page.getByRole("button", { name: "Restore from my account" }).click();
  await expect(page.getByText(/Last synced/)).toBeVisible();
  await page.getByRole("button", { name: "Back to training" }).click();
  return { context, page };
}

async function editNote(page: Page, note: string) {
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/Note/).fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(note)).toBeVisible();
}

async function syncNow(page: Page) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
}

test("the same session edited on two devices is kept for review, never overwritten", async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const server = cloud();
  await firstDeviceWithSession(page, server);
  const b = await secondDevice(browser, server);
  try {
    await editNote(page, "Edited on the phone");
    await editNote(b.page, "Edited on the tablet");

    await syncNow(page);
    await expect(page.getByText(/Last synced/)).toBeVisible();
    await syncNow(b.page);

    // The second device gets a readable review rather than silently losing either note.
    await expect(b.page.getByText("1 change needs your review.")).toBeVisible();
    const card = b.page.locator(".account-conflict").filter({ hasText: "Timed session from" });
    await expect(card.getByRole("region", { name: "This device’s version" })).toContainText("Note: Edited on the tablet");
    await expect(card.getByRole("region", { name: "Cloud version" })).toContainText("Note: Edited on the phone");
    await expect(card).not.toContainText("session:");
    await card.screenshot({ path: info.outputPath("sync-conflict.png") });
    expect(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Until resolved, this device keeps showing its own edit.
    await b.page.getByRole("button", { name: "History", exact: true }).click();
    await expect(b.page.getByText("Edited on the tablet")).toBeVisible();

    await b.page.getByRole("button", { name: "More", exact: true }).click();
    await card.getByRole("button", { name: "Use cloud version" }).click();
    await expect(b.page.getByText(/your review/)).toHaveCount(0);
    await expect(b.page.getByRole("button", { name: "Download conflict archive" })).toBeVisible();
    await b.page.getByRole("button", { name: "History", exact: true }).click();
    await expect(b.page.getByText("Edited on the phone")).toBeVisible();
    await expect(b.page.getByText("Edited on the tablet")).toHaveCount(0);

    // Both devices converge on one copy of the session.
    await syncNow(b.page);
    await syncNow(page);
    for (const device of [page, b.page]) {
      await device.getByRole("button", { name: "History", exact: true }).click();
      await expect(device.getByText("Edited on the phone")).toHaveCount(1);
    }
  } finally {
    await b.context.close();
  }
});

test("a session deleted on one device and edited on another can be kept", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const server = cloud();
  await firstDeviceWithSession(page, server);
  const b = await secondDevice(browser, server);
  try {
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete session" }).click();
    await expect(page.getByText("Your first completed session will appear here.")).toBeVisible();
    await syncNow(page);
    await expect(page.getByText(/Last synced/)).toBeVisible();

    await editNote(b.page, "Worth keeping");
    await syncNow(b.page);
    await expect(b.page.getByText("1 change needs your review.")).toBeVisible();
    const card = b.page.locator(".account-conflict").filter({ hasText: "Timed session from" });
    await expect(card.getByRole("region", { name: "Cloud version" })).toContainText("Deleted");
    await expect(card.getByRole("region", { name: "This device’s version" })).toContainText("Note: Worth keeping");

    await card.getByRole("button", { name: "Keep this device’s version" }).click();
    await expect(b.page.getByText(/your review/)).toHaveCount(0);
    await syncNow(b.page);
    await expect(b.page.getByText(/Last synced/)).toBeVisible();

    // The kept session returns to the device that deleted it.
    await syncNow(page);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByText("Worth keeping")).toHaveCount(1);
  } finally {
    await b.context.close();
  }
});
