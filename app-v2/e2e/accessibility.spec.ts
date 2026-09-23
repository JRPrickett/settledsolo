import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? "")
  );

  expect(
    blocking,
    blocking
      .map(
        (violation) =>
          `${violation.id}: ${violation.help}\n${violation.nodes
            .map((node) => `  ${node.target.join(" ")} — ${node.failureSummary ?? ""}`)
            .join("\n")}`
      )
      .join("\n\n")
  ).toEqual([]);
}

test("public homepage has no serious WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Calm starts with small steps." })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("first-run app shell has no serious WCAG A/AA violations", async ({ page }) => {
  await page.goto("/app/");
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
  await expectNoSeriousViolations(page);
});


test("guided onboarding remains accessible through routing and plan review", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: /^I'm not sure/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Start with a 3-second observation." })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("public information pages have no serious WCAG A/AA violations", async ({ page }) => {
  for (const path of ["/help", "/resources", "/evidence", "/contact", "/privacy", "/terms", "/missing"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
  }
});

test("training screens stay accessible through a full session", async ({ page }) => {
  test.setTimeout(90_000);
  await completeSetup(page, 1);
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expectNoSeriousViolations(page);
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const screen of ["Progress", "History", "More"]) {
    await nav.getByRole("button", { name: screen }).click();
    await expectNoSeriousViolations(page);
  }

  await nav.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /Edit/ }).first().click();
  await expect(page.getByLabel(/Note/)).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("an early, difficult return keeps the review accessible", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Distressed/ }).click();
  await expect(page.getByText("Why did you come back early?")).toBeVisible();
  await expectNoSeriousViolations(page);
});
