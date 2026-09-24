import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { completeSetup } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

function session(id: string, daysAgo: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    at: Date.now() - daysAgo * DAY,
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

async function restore(page: Page, sessions: unknown[], journal: unknown[] = []) {
  await page.getByRole("button", { name: "More" }).click();
  await page.getByLabel("Choose backup file").setInputFiles({
    name: "context.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        appData: {
          dogName: "Mabel",
          activeScenarioId: "training",
          onboarding: { version: 2, startingPath: "known-duration", completedAt: Date.now() - 60 * DAY },
          scenarios: [{ id: "training", label: "Front door", startSeconds: 45, sessions }],
          journal
        }
      })
    )
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await expect(page.getByRole("heading", { name: "You & Mabel" })).toBeVisible();
}

async function expectNoSeriousAxeViolations(page: Page) {
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)
  ).toEqual([]);
}

test("a first sign of concern can be marked, undone and saved with the session", async ({ page }) => {
  await completeSetup(page, 1);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const mark = page.getByRole("button", { name: "Mark first sign of concern" });
  await expect(mark).toBeVisible();
  await page.waitForTimeout(1_100);
  await mark.click();
  await expect(page.getByText(/^First sign marked at \d+s\./)).toBeVisible();

  // Undo returns the button; marking again records the later time.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(mark).toBeVisible();
  await page.waitForTimeout(1_100);
  await mark.click();
  const marked = page.getByText(/^First sign marked at \d+s\./);
  await expect(marked).toBeVisible();
  const markedText = (await marked.textContent()) ?? "";
  const seconds = markedText.match(/at (\d+)s/)?.[1];
  expect(Number(seconds)).toBeGreaterThanOrEqual(2);

  // The mark survives a reload of the running session.
  await page.reload();
  await expect(page.getByText(`First sign marked at ${seconds}s.`, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "I'm back" }).click();
  await expect(page.getByText(`First sign of concern marked at ${seconds}s.`, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: /^Some concern/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText(`First sign at ${seconds}s`)).toBeVisible();
});

test("the journal plans, logs and deletes absences and home changes", async ({ page }) => {
  await completeSetup(page, 45);

  // The coverage card leads to the planner.
  await page.getByRole("button", { name: "Plan this week's absences" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Life around training." })).toBeFocused();

  const planner = page.getByRole("region", { name: "This week's absences" });
  await expect(planner.getByText("Nothing planned for the next seven days.")).toBeVisible();
  const tomorrow = new Date(Date.now() + DAY);
  const tomorrowValue = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await planner.getByLabel("Date").fill(tomorrowValue);
  await planner.getByLabel("hours").fill("3");
  await planner.getByLabel("minutes").fill("30");
  await planner.getByLabel("Note").fill("Dentist");
  await planner.getByRole("button", { name: "Add planned absence" }).click();
  await expect(planner.getByText("3 h 30 min · Not covered yet · Dentist")).toBeVisible();

  const absences = page.getByRole("region", { name: "Absences you couldn't avoid" });
  await absences.getByLabel("How was Mabel?").selectOption("concern");
  await absences.getByLabel("Note").fill("Barked at first");
  await absences.getByRole("button", { name: "Log this absence" }).click();
  await expect(absences.getByText("1 h alone · Some concern · Barked at first")).toBeVisible();

  const events = page.getByRole("region", { name: "Changes at home" });
  await events.getByLabel("What changed").selectOption("moved-home");
  await events.getByLabel("Note").fill("New flat");
  await events.getByRole("button", { name: "Add this change" }).click();
  await expect(events.getByText("Moved home · New flat")).toBeVisible();

  // Every text control stays at least 16px so iOS does not zoom on focus.
  const fontSizes = await page
    .locator(".journal-shell :is(input, select)")
    .evaluateAll((elements) => elements.map((element) => parseFloat(getComputedStyle(element).fontSize)));
  expect(fontSizes.length).toBeGreaterThan(0);
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(16);

  await expectNoSeriousAxeViolations(page);

  // It persists across a reload and shows up on Today, Progress and History.
  // Each list renders only after its save resolves, so the data is already stored.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("1 planned this week · 1 without cover yet")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 planned this week · 1 without cover yet")).toBeVisible();

  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Changes at home." })).toBeVisible();
  await expect(page.getByText("Moved home", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: "Absences outside training and changes at home" }).click();
  await expect(page.getByRole("heading", { name: "Absences you couldn't avoid" })).toBeFocused();

  page.on("dialog", (dialog) => void dialog.accept());
  await planner.getByRole("button", { name: "Delete" }).click();
  await expect(planner.getByText("Nothing planned for the next seven days.")).toBeVisible();
  await absences.getByRole("button", { name: "Delete" }).click();
  await expect(absences.getByText("Barked at first", { exact: false })).toHaveCount(0);
  await events.getByRole("button", { name: "Delete" }).click();
  await expect(events.getByText("New flat", { exact: false })).toHaveCount(0);
});

test("a difficult unavoidable absence holds or eases Today's plan and appears in the summary", async ({ page }) => {
  await completeSetup(page, 45);
  await restore(
    page,
    [session("one", 3), session("two", 2), session("three", 1)],
    [
      {
        type: "real-absence",
        id: "absence-1",
        at: Date.now() - 2 * 60 * 60 * 1000,
        durationSeconds: 3 * 60 * 60,
        outcome: "concern",
        note: ""
      }
    ]
  );

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText(/showed some concern, so today holds at 1:00 instead of stepping up\./)).toBeVisible();

  // Logging a distressing absence steps the plan back and suggests rest.
  await page.getByRole("button", { name: "Log an absence you couldn't avoid" }).click();
  const absences = page.getByRole("region", { name: "Absences you couldn't avoid" });
  await absences.getByLabel("How was Mabel?").selectOption("distressed");
  await absences.getByRole("button", { name: "Log this absence" }).click();
  await expect(absences.getByText("1 h alone · Distressed")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Consider a rest day.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Looking after yourself" })).toHaveAttribute(
    "href",
    "/help#looking-after-yourself"
  );
  await page.getByRole("button", { name: "Train anyway" }).click();
  await expect(page.getByText(/was distressing, so today steps back rather than up\./)).toBeVisible();

  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Open a summary to share" }).click();
  await expect(page.getByRole("heading", { name: "Changes and other absences" })).toBeVisible();
  await expect(page.getByText("3 h alone, some concern", { exact: false }).filter({ visible: true }).first()).toBeVisible();
});

test("a long plateau suggests looking wider, and Progress compares the last two months", async ({ page }) => {
  await completeSetup(page, 45);
  const sessions = Array.from({ length: 14 }, (_, index) =>
    session(`s${index}`, 40 - index * 3)
  );
  await restore(page, sessions);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText("Progress has levelled off.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Read more about plateaus" })).toHaveAttribute(
    "href",
    "/help#when-progress-stalls"
  );
  await expect(page.getByRole("link", { name: "Looking after yourself" })).toBeVisible();
  // A plateau never blocks training.
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.getByRole("button", { name: "Progress" }).click();
  const trend = page.getByRole("region", { name: "The last 30 days against the 30 before." });
  await expect(trend).toBeVisible();
  await expect(trend.getByRole("row", { name: /^Sessions/ })).toContainText("10");
  await expect(trend.getByRole("row", { name: /^Sessions/ })).toContainText("4");
  await expect(trend.getByRole("row", { name: /^Longest relaxed/ })).toContainText("1:00");
});
