import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

function session(id: string, daysAgo: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    at: Date.UTC(2026, 8, 20, 12) - daysAgo * DAY,
    targetSeconds: 60,
    actualSeconds: 60,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: "",
    ...overrides
  };
}

async function restore(page: import("@playwright/test").Page, sessions: unknown[]) {
  await page.getByRole("button", { name: "More" }).click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "summary.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-09-20T00:00:00.000Z",
        appData: {
          dogName: "Mabel",
          activeScenarioId: "training",
          onboarding: { version: 2, startingPath: "known-duration", completedAt: Date.UTC(2026, 8, 1) },
          scenarios: [{ id: "training", label: "Front door", startSeconds: 45, sessions }]
        }
      })
    )
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
}

test("the professional summary shows the record, prints, downloads and keeps notes optional", async ({ page }) => {
  // Read the actual download content in both engines without depending on a native save dialog.
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (value) => {
      if (value instanceof Blob && value.type.startsWith("text/html")) {
        void value.text().then((text) => {
          document.documentElement.dataset.summaryFile = text;
        });
      }
      return original(value);
    };
  });
  await completeSetup(page, 45);
  await restore(page, [
    session("calm", 3, { tags: ["food-left"] }),
    session("worried", 2, {
      targetSeconds: 66,
      actualSeconds: 40,
      outcome: "concern",
      stoppedEarly: true,
      signals: ["whining"],
      tags: ["noise-disturbance"],
      stopReason: "Whined at the door",
      note: "Drilling next door <b>started</b>"
    }),
    session("latest", 1, { targetSeconds: 36, actualSeconds: 36 })
  ]);

  await page.evaluate(() => {
    (window as typeof window & { printed?: number }).printed = 0;
    window.print = () => {
      (window as typeof window & { printed?: number }).printed! += 1;
    };
  });

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Open a summary to share" }).click();

  const heading = page.getByRole("heading", { level: 1, name: "Mabel's separation training record" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle(/^Mabel training summary/);
  await expect(page.getByRole("heading", { name: "Front door" })).toBeVisible();
  await expect(page.getByText("3: 2 relaxed, 1 some concern, 0 distressed")).toBeVisible();
  // Phones list the sessions; the same rows print as a table.
  const visible = (text: string) => page.getByText(text).filter({ visible: true });
  await expect(visible("Whining, Noise or disturbance")).toBeVisible();

  // Owner-entered text renders as text, and can be left out before sharing.
  await expect(visible("Drilling next door <b>started</b>")).toBeVisible();
  await expect(visible("Came back because: Whined at the door")).toBeVisible();
  await page.getByLabel("Include notes").uncheck();
  await expect(page.getByText("Drilling next door <b>started</b>")).toHaveCount(0);
  await expect(page.getByText("Came back because: Whined at the door")).toHaveCount(0);
  await page.getByLabel("Include notes").check();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)
  ).toEqual([]);

  await page.getByRole("button", { name: "Print or save as PDF" }).click();
  expect(await page.evaluate(() => (window as typeof window & { printed?: number }).printed)).toBe(1);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download as a file" }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^settledsolo-summary-\d{4}-\d{2}-\d{2}\.html$/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.summaryFile ?? ""))
    .toContain("</html>");
  const file = await page.evaluate(() => document.documentElement.dataset.summaryFile ?? "");
  expect(file).toContain("<title>Mabel training summary");
  expect(file).toContain("Mabel's separation training record");
  expect(file).toContain("Drilling next door &lt;b&gt;started&lt;/b&gt;");
  expect(file).not.toContain("<b>started</b>");
  expect(file).toMatch(/\.summary-sheet\s*\{/);
  expect(file).toContain("@media print");

  // In print, only the document remains and sessions print as a table.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Owner's notes" })).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open a summary to share" })).toBeVisible();
  await expect(page).toHaveTitle(/SettledSolo/);
});

test("History and a paused plan both lead to the summary", async ({ page }) => {
  await completeSetup(page, 45);
  await restore(page, [
    session("calm", 2),
    session("escape", 1, {
      outcome: "distressed",
      stoppedEarly: true,
      actualSeconds: 20,
      signals: ["escape-attempt"]
    })
  ]);

  await page.getByRole("button", { name: "Open a summary to share with them" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mabel's separation training record" })).toBeVisible();
  await expect(page.getByText("Timed departures paused after a high-risk sign")).toBeVisible();
  await expect(page.getByText("High-risk sign recorded", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Open a summary to share with your vet or trainer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mabel's separation training record" })).toBeVisible();
});
