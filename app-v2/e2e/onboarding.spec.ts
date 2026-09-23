import { expect, test } from "@playwright/test";

async function expectNoSub16pxFormControls(
  page: import("@playwright/test").Page
) {
  const controls = page.locator(
    'input:not([type="checkbox"]):not([type="radio"]), select, textarea'
  );
  const tooSmall = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        label:
          element.getAttribute("aria-label") ??
          element.getAttribute("name") ??
          element.getAttribute("placeholder") ??
          "",
        fontSize: Number.parseFloat(window.getComputedStyle(element).fontSize)
      }))
      .filter((control) => control.fontSize < 16)
  );

  expect(tooSmall).toEqual([]);
}

test("mobile form controls remain at least 16px to prevent iOS focus zoom", async ({ page }) => {
  await page.goto("/app/");
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
  await expectNoSub16pxFormControls(page);

  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("Comfortable duration")).toBeVisible();
  await expectNoSub16pxFormControls(page);

  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await page.getByRole("button", { name: "More" }).click();

  await expect(page.getByRole("heading", { name: /training settings/i })).toBeVisible();
  await expectNoSub16pxFormControls(page);
});

test("setup asks for a vet check first after sudden onset, age or illness, and reassures new homes", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(/started suddenly, or Mabel is older or has been unwell/)).toBeVisible();
  await expect(page.getByText(/Medical problems can cause or add to distress/)).toBeVisible();

  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Not yet/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("New to your home?", { exact: true })).toBeVisible();
  await expect(page.getByText(/some worry when left may be settling in/)).toBeVisible();
});

test("setup accepts an observed comfortable duration and converts minutes to seconds", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const duration = page.getByLabel("Comfortable duration");
  await duration.fill("");
  await duration.type("25");
  await expect(duration).toHaveValue("25");

  await duration.fill("1");
  await page.getByLabel("Duration unit").selectOption("minutes");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await expect(page.getByText("1 minute", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByText("1:00")).toBeVisible();
});

test("HTML-like dog names are rendered as text and cannot execute", async ({
  page,
}) => {
  const name = "<img src=x onerror=window.x=1>";
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as typeof window & { x?: number }).x,
    ),
  ).toBeUndefined();
});

test("onboarding routes cue-sensitive dogs to departure-cue practice before leaving", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Gets watchful or follows me/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Start before the leaving part." })).toBeVisible();
  await expect(page.getByText("Departure cues first", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByRole("heading", { name: "Departure cues first" })).toBeVisible();
  await page.getByRole("button", { name: "Start departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();
});

test("onboarding uses a clearly-labelled micro departure when no comfortable absence is known", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^I'm not sure/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Start with a 3-second observation." })).toBeVisible();
  await expect(page.getByText(/conservative SettledSolo heuristic/)).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByText("Starting observation", { exact: true })).toBeVisible();
  await expect(page.getByText("3s")).toBeVisible();
});
