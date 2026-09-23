import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("public SettledSolo site leads into the PWA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Calm starts with small steps\./ })).toBeVisible();
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
