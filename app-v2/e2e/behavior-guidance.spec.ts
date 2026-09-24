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
  await completeSetup(page, 1, false);

  const card = page.getByRole("heading", { name: "Observe one known-safe absence" });
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
  await completeSetup(page, 1, false);

  const card = page.getByRole("heading", { name: "Observe one known-safe absence" });
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
    page.getByRole("heading", { name: "Observe one known-safe absence" })
  ).toBeHidden();
});

test("known-duration onboarding does not stage an unnecessary observation", async ({ page }) => {
  await completeSetup(page, 30);
  await expect(
    page.getByRole("heading", { name: "Observe one known-safe absence" })
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

test("food, a remote feeder, noise and someone-home context tags reach history", async ({ page }) => {
  await completeSetup(page, 1);

  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /^Relaxed/ }).click();

  const tags = ["Food or chew left", "Remote treat feeder used", "Noise or disturbance", "Someone else was home"];
  for (const tag of tags) {
    await page.getByRole("button", { name: tag, exact: true }).click();
  }
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  for (const tag of tags) {
    await expect(page.getByText(tag, { exact: true })).toBeVisible();
  }
});

test("a high-risk observation pauses timed training immediately", async ({ page }) => {
  await completeSetup(page, 1);
  await page.getByRole("button", { name: "More" }).click();

  const backup = {
    schemaVersion: 1,
    exportedAt: "2026-09-18T00:00:00.000Z",
    appData: {
      dogName: "Mabel",
      activeScenarioId: "training",
      scenarios: [{
        id: "training",
        label: "Home alone",
        startSeconds: 1,
        sessions: [{
          id: "high-risk",
          at: Date.UTC(2026, 8, 20, 12, 0, 0),
          targetSeconds: 1,
          actualSeconds: 1,
          outcome: "distressed",
          stoppedEarly: false,
          signals: ["escape-attempt"],
          tags: [],
          stopReason: "",
          note: ""
        }]
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "high-risk.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();

  await expect(page.getByText("Pause timed departures.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start today's session" })).toBeHidden();
  // The plan headline says training is paused rather than offering a departure length.
  await expect(page.getByRole("heading", { level: 1, name: "Paused" })).toBeVisible();
  await expect(page.getByText("main departure", { exact: true })).toBeHidden();
  await expect(page.getByText("Why this plan?")).toBeHidden();
});

test("after a regression below the starting duration, the plan follows the dog down", async ({ page }) => {
  await completeSetup(page, 1);
  await page.getByRole("button", { name: "More" }).click();

  // Started from a known-comfortable 2 minutes, then distress 40 seconds into a shorter session.
  const backup = {
    schemaVersion: 1,
    exportedAt: "2026-09-18T00:00:00.000Z",
    appData: {
      dogName: "Mabel",
      activeScenarioId: "training",
      scenarios: [{
        id: "training",
        label: "Home alone",
        startSeconds: 120,
        sessions: [
          {
            id: "comfortable",
            at: Date.UTC(2026, 8, 19, 12, 0, 0),
            targetSeconds: 120,
            actualSeconds: 120,
            outcome: "relaxed",
            stoppedEarly: false,
            signals: [],
            tags: [],
            stopReason: "",
            note: ""
          },
          {
            id: "regressed",
            at: Date.UTC(2026, 8, 20, 12, 0, 0),
            targetSeconds: 95,
            actualSeconds: 40,
            outcome: "distressed",
            stoppedEarly: true,
            signals: ["barking-howling"],
            tags: [],
            stopReason: "",
            note: ""
          }
        ]
      }]
    }
  };

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "regression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole("button", { name: "Restore this backup" }).click();

  // One step below the 40-second distress point, not back up to the 2-minute start.
  await expect(page.getByRole("heading", { level: 1, name: "36s" })).toBeVisible();
  await expect(page.getByText("Easier today", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "2:00" })).toBeHidden();
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

async function savedCueSets(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("dog-training-app", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<{ value: { scenarios: Array<{ cuePractice?: { sessions: unknown[] } }> } }>(
      (resolve) => {
        const request = db.transaction("records").objectStore("records").get("app-data");
        request.onsuccess = () => resolve(request.result);
      }
    );
    db.close();
    return record.value.scenarios.reduce(
      (total, scenario) => total + (scenario.cuePractice?.sessions.length ?? 0),
      0
    );
  });
}

test("an unfinished cue set survives a reload and saves exactly once", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await expect(page.getByText("Rep 2 of 3")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Rep 2 of 3")).toBeVisible();

  // Closing with recorded reps asks first and defaults to keeping them.
  await page.getByRole("button", { name: "Close" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Keep practising" })).toBeFocused();
  await dialog.getByRole("button", { name: "Keep practising" }).click();
  await expect(page.getByText("Rep 2 of 3")).toBeVisible();

  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  const save = page.getByRole("button", { name: "Save cue practice" });
  await save.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  expect(await savedCueSets(page)).toBe(1);

  await page.reload();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  expect(await savedCueSets(page)).toBe(1);
});

test("a discarded cue set is not saved or resumed", async ({ page }) => {
  await completeSetup(page, 5);

  // An untouched set closes immediately.
  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();

  await page.getByRole("button", { name: "Departure cue practice" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard set" }).click();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  expect(await savedCueSets(page)).toBe(0);
});

test("a cue set already saved before the app closed is not resumed again", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "Departure cue practice" }).click();
  for (let rep = 0; rep < 3; rep += 1) {
    await page.getByRole("button", { name: /Relaxed/ }).click();
  }
  // Model the app being killed after the save but before its checkpoint was cleared.
  const checkpoint = await page.evaluate(() => localStorage.getItem("settledsolo.cue-practice.v1"));
  await page.getByRole("button", { name: "Save cue practice" }).click();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  await page.evaluate((value) => localStorage.setItem("settledsolo.cue-practice.v1", value!), checkpoint);

  await page.reload();
  await expect(page.getByRole("button", { name: "Departure cue practice" })).toBeVisible();
  expect(await savedCueSets(page)).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("settledsolo.cue-practice.v1"))).toBeNull();
});
