import { expect, test } from "@playwright/test";

async function completeSetup(page: import("@playwright/test").Page) {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Comfortable duration").fill("1");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await expect(
    page.getByRole("button", { name: "Start today's session" })
  ).toBeVisible();
}

async function waitForProductionServiceWorker(
  page: import("@playwright/test").Page
) {
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });

  // Reload once online so the newly activated worker takes control.
  await page.reload();
  await page.waitForFunction(
    () =>
      "serviceWorker" in navigator &&
      navigator.serviceWorker.controller !== null
  );
}

test("production PWA service worker installs and controls the app", async ({
  page
}) => {
  await completeSetup(page);
  await waitForProductionServiceWorker(page);

  await expect(
    page.getByRole("heading", { name: "You & Mabel" })
  ).toBeVisible();

  const controlled = await page.evaluate(
    () =>
      "serviceWorker" in navigator &&
      navigator.serviceWorker.controller !== null
  );
  expect(controlled).toBe(true);

  const serviceWorkerSource = await page.evaluate(() =>
    fetch("/sw.js").then((response) => response.text())
  );
  const pushHandlerSource = await page.evaluate(() =>
    fetch("/push-sw.js").then((response) => response.text())
  );
  expect(serviceWorkerSource).toContain("push-sw.js");
  expect(pushHandlerSource).toContain("Time to come back");
  expect(pushHandlerSource).toContain('self.addEventListener("push"');
});

test("Chromium production PWA relaunches and saves a session while offline", async ({
  page,
  context
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-pwa",
    "Playwright WebKit currently throws an internal error when offline mode is combined with reload; real iOS Airplane Mode remains a physical-device gate."
  );

  await completeSetup(page);
  await waitForProductionServiceWorker(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "You & Mabel" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" })
  ).toBeVisible();

  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("target 1s")).toHaveCount(1);

  await context.setOffline(false);
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("target 1s")).toHaveCount(1);
});
