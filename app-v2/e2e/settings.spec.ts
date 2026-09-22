import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("training settings persist after save and reload", async ({ page }) => {
  await completeSetup(page, 30);
  await page.getByRole("button", { name: "More" }).click();

  await page.getByLabel("Track name", { exact: true }).fill("Evening routine");
  await page.getByLabel("Track starting comfort", { exact: true }).fill("90");
  await page.getByLabel("Warm-up count").fill("3");
  await page.getByLabel("Suggested settle time").fill("45");
  await page.getByRole("button", { name: "Save track changes" }).click();

  await page.getByLabel("Daily main-departure cap").fill("2");
  await page.getByRole("button", { name: "Save daily ceiling" }).click();

  await page.reload();
  await page.getByRole("button", { name: "More" }).click();

  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("Evening routine");
  await expect(page.getByLabel("Track starting comfort", { exact: true })).toHaveValue("90");
  await expect(page.getByLabel("Warm-up count")).toHaveValue("3");
  await expect(page.getByLabel("Suggested settle time")).toHaveValue("45");
  await expect(page.getByLabel("Daily main-departure cap")).toHaveValue("2");
  await expect(page.getByLabel("Daily main-departure cap")).toHaveAttribute("max", "3");
});

test("Today exposes a warm-up duration shuffle", async ({ page }) => {
  await completeSetup(page, 30);
  await expect(
    page.getByRole("button", { name: "Shuffle warm-up durations" })
  ).toBeVisible();
});
