import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

// Runs in the production-bundle gate, whose preview server sends the Worker's CSP.
test("public pages and a full training session run without CSP violations", async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const collected: string[] = [];
  const collect = async () => {
    collected.push(
      ...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []))
    );
  };

  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("style-src 'self'");
  expect(response?.headers()["content-security-policy"]).not.toContain("unsafe-inline");

  for (const path of ["/", "/help", "/resources", "/evidence", "/contact", "/privacy", "/terms", "/missing"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await collect();
  }

  await completeSetup(page, 1);
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();

  for (const screen of ["Progress", "History", "More", "Today"]) {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: screen }).click();
    await page.waitForTimeout(200);
  }
  await collect();

  expect(collected).toEqual([]);
});
