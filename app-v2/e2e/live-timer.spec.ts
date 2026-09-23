import { expect, test, type Page } from "@playwright/test";
import { completeSetup } from "./helpers";

/** The clock text must sit on one line, inside the ring's inner circle. */
async function expectClockInsideRing(page: Page) {
  const fit = await page.locator(".progress-ring").evaluate((ring) => {
    const clock = ring.querySelector<HTMLElement>(".live-clock")!;
    const outer = ring.getBoundingClientRect();
    const text = clock.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(clock).fontSize);
    return {
      text: clock.textContent,
      // The inner edge of the stroke is about 76% of the ring's width.
      innerDiameter: outer.width * 0.76,
      width: text.width,
      lines: Math.round(text.height / (fontSize * 1.0)),
      left: text.left - outer.left,
      right: outer.right - text.right
    };
  });
  expect(fit.width, `"${fit.text}" is ${fit.width}px in a ${fit.innerDiameter}px ring`).toBeLessThanOrEqual(fit.innerDiameter);
  expect(fit.lines, `"${fit.text}" wrapped`).toBe(1);
  expect(fit.left).toBeGreaterThan(0);
  expect(fit.right).toBeGreaterThan(0);
}

test("the countdown fits inside the ring before and after the target", async ({ page }) => {
  await completeSetup(page, 2);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect(page.getByText("Time remaining")).toBeVisible();
  await expectClockInsideRing(page);

  await expect(page.getByText("Target reached")).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".live-clock")).toHaveText(/^\+0:0\d$/);
  await expectClockInsideRing(page);
});

test("a multi-hour target still fits inside the ring", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Comfortable duration").fill("120");
  await page.getByLabel("Duration unit").selectOption("minutes");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  // Skip practice departures so the widest clock, the main h:mm:ss countdown, shows.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Warm-up count").fill("0");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await expect(page.getByText("Main departure", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await expect(page.locator(".live-clock")).toHaveText(/^[1-9]:\d\d:\d\d$/);
  await expectClockInsideRing(page);
});

test("the ring fills smoothly between whole seconds", async ({ page }) => {
  await completeSetup(page, 30);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const ring = page.locator(".progress-ring-value");
  const offsets = await ring.evaluate(async (circle) => {
    const samples: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      samples.push(Number(circle.getAttribute("stroke-dashoffset")));
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return samples;
  });
  // Four samples within half a second must all differ; whole-second steps would repeat.
  expect(new Set(offsets).size).toBe(offsets.length);
  expect(offsets[3]).toBeLessThan(offsets[0]);
});

test("reduced motion keeps the ring stepping once a second", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeSetup(page, 30);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const offsets = await page.locator(".progress-ring-value").evaluate(async (circle) => {
    const samples: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      samples.push(circle.getAttribute("stroke-dashoffset") ?? "");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return samples;
  });
  expect(new Set(offsets).size).toBeLessThanOrEqual(2);
});
