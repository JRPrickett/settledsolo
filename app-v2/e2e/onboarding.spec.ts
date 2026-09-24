import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

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

test("each setup step and the first Today screen open at the top on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));

  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What happens when you get ready to go?" })).toBeVisible();
  await expect.poll(scrollY).toBe(0);

  // Continue sits below the fold, so the owner has scrolled before moving on.
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  const next = page.getByRole("button", { name: "Continue" });
  await next.scrollIntoViewIfNeeded();
  expect(await scrollY()).toBeGreaterThan(0);
  await next.click();
  await expect(page.getByRole("heading", { name: /^Have you already seen Mabel/ })).toBeVisible();
  await expect.poll(scrollY).toBe(0);

  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Comfortable duration")).toBeVisible();
  await expect.poll(scrollY).toBe(0);

  await page.getByLabel("Comfortable duration").fill("45");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await expect(page.getByRole("heading", { name: "Start from known comfort." })).toBeVisible();
  await expect.poll(scrollY).toBe(0);

  const usePlan = page.getByRole("button", { name: "Use this starting plan" });
  await usePlan.scrollIntoViewIfNeeded();
  expect(await scrollY()).toBeGreaterThan(0);
  await usePlan.click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeAttached();
  await expect.poll(scrollY).toBe(0);
  await expect(page.getByText("Today's plan", { exact: true })).toBeInViewport();
});

async function buttonWordsBrokenAcrossLines(page: import("@playwright/test").Page) {
  return page.locator("button:visible").evaluateAll((buttons) => {
    const broken: string[] = [];
    for (const button of buttons) {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index ?? 0);
          range.setEnd(node, (match.index ?? 0) + match[0].length);
          const lineTops = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0)
              .map((rect) => Math.round(rect.top))
          );
          if (lineTops.size > 1) broken.push(`${button.textContent?.trim()}: "${match[0]}"`);
        }
      }
    }
    return broken;
  });
}

test("button labels never break mid-word on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await completeSetup(page, 45);
  await expect(page.getByRole("button", { name: "Account & backup" })).toBeVisible();
  expect(await buttonWordsBrokenAcrossLines(page)).toEqual([]);

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("heading", { name: /training settings/i })).toBeVisible();
  expect(await buttonWordsBrokenAcrossLines(page)).toEqual([]);
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
  await expect(page.getByText(/cautious SettledSolo rule of thumb/)).toBeVisible();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByText("Starting observation", { exact: true })).toBeVisible();
  await expect(page.getByText("3s")).toBeVisible();
});
