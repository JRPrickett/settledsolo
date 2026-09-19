import { expect } from "@playwright/test";

  expect(tooSmall).toEqual([]);
}

export async function completeSetup(page: import("@playwright/test").Page, seconds = 1) {
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

