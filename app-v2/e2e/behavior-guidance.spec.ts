import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("departure cue practice only advances after repeated calm sets", async ({ page }) => {
  await completeSetup(page, 5);

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();

  for (let rep = 0; rep < 3; rep += 1) {
    await page.getByRole("button", { name: /Relaxed/ }).click();
  }
  await page.getByRole("button", { name: "Save cue practice" }).click();

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Walk toward the exit, then turn away" })
  ).toBeVisible();

  for (let rep = 0; rep < 3; rep += 1) {
    await page.getByRole("button", { name: /Relaxed/ }).click();
  }
  await page.getByRole("button", { name: "Save cue practice" }).click();

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Stand near the exit for a moment, then move away" })
  ).toBeVisible();
});

test("a one-time observation runs before duration training and is not asked again", async ({ page }) => {
  await completeSetup(page, 1);

  const card = page.getByRole("heading", { name: "Watch Mabel alone once" });
  await expect(card).toBeVisible();
  // The step never blocks training.
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();

  await page.getByRole("button", { name: "I've watched them alone" }).click();
  await page
    .getByRole("button", { name: /^They were calmer when not shut in/ })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Guidance points at the existing free-roam comparison and never diagnoses.
  await expect(page.getByText(/free-roam session tags/)).toBeVisible();
  await expect(page.getByText(/does not diagnose/)).toBeVisible();

  await page.getByRole("button", { name: "Save and start training" }).click();
  await expect(card).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expect(card).toBeHidden();
});

test("skipping the one-time observation is remembered across a reload", async ({ page }) => {
  await completeSetup(page, 1);

  const card = page.getByRole("heading", { name: "Watch Mabel alone once" });
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Skip this step" }).click();
  await expect(card).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();
  await expect(card).toBeHidden();
});

test("a cue-first plan is not asked to leave the dog alone to observe", async ({ page }) => {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Gets watchful or follows me/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();

  await expect(page.getByRole("heading", { name: "Departure cues first" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Watch Mabel alone once" })
  ).toBeHidden();
});

test("food refusal can be recorded as an observed signal and reaches history", async ({ page }) => {
  await completeSetup(page, 1);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await expect(page.getByText("Today's main departure")).toBeVisible();

  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();

  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" })
  ).toBeVisible();
  // The signal list only appears once a non-relaxed outcome is chosen.
  await page.getByRole("button", { name: /Some concern/ }).click();
  await page.getByRole("button", { name: "Refused food or treats" }).click();
  await page.getByRole("button", { name: "Save session" }).click();

  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByText("Refused food or treats")).toBeVisible();
});

test("persistent difficulty without progress suggests involving a vet, without prescribing", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More" }).click();

  // Ten sessions, difficulty persisting and the target never moving on.
  const outcomes = [
    "distressed", "concern", "distressed", "concern", "relaxed",
    "concern", "distressed", "relaxed", "concern", "concern"
  ];
  const backup = {
    schemaVersion: 1,
    exportedAt: "2026-09-18T00:00:00.000Z",
    appData: {
      dogName: "Ruby",
      activeScenarioId: "training",
      scenarios: [{
        id: "training",
        label: "Home alone",
        startSeconds: 30,
        sessions: outcomes.map((outcome, index) => ({
          id: `stalled-${index}`,
          at: Date.UTC(2026, 8, 1 + index, 12, 0, 0),
          targetSeconds: 30,
          actualSeconds: 30,
          outcome,
          stoppedEarly: false,
          signals: [],
          tags: [],
          stopReason: "",
          note: ""
        }))
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();

  await expect(page.getByRole("heading", { name: "You & Ruby" })).toBeVisible();
  await expect(page.getByText("Worth involving a vet at this point.")).toBeVisible();
  await expect(page.getByText(/veterinary behaviourist/)).toBeVisible();

  // It suggests a conversation, never a treatment, and never blames the owner.
  await expect(page.getByText(/talk through whether medication/)).toBeVisible();
  await expect(page.getByText(/isn't a sign you have done anything wrong/)).toBeVisible();

  // It supersedes the generic support card rather than stacking with it.
  await expect(page.getByText(/Certified Separation Anxiety Trainer/)).toBeHidden();
});
