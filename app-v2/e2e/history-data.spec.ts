import { expect, test } from "@playwright/test";
import { completeSetup } from "./helpers";

test("history supports add, edit and confirmed delete without leaving stale records", async ({ page }) => {
  await completeSetup(page, 5);
  await page.getByRole("button", { name: "History" }).click();

  await expect(
    page.getByText(/Stored locally on this device/)
  ).toBeVisible();

  await page.getByRole("button", { name: "Log a past session" }).click();
  await page.getByLabel("Target", { exact: false }).fill("20");
  await page.getByLabel("Actual", { exact: false }).fill("10");
  await page.getByLabel("Outcome").selectOption("concern");
  await page.getByLabel(/Why did they come back early/).fill("Whined at the door");
  await page.getByLabel(/Note/).fill("First history note");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Some concern", { exact: true })).toBeVisible();
  await expect(page.getByText("First history note")).toBeVisible();
  await expect(page.getByText("target 20s")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Actual", { exact: false }).fill("12");
  await page.getByLabel(/Note/).fill("Edited history note");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Edited history note")).toBeVisible();
  await expect(page.getByText("First history note")).toHaveCount(0);
  await expect(page.getByText("12s", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete session" }).click();

  await expect(
    page.getByText("Your first completed session will appear here.")
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "History" }).click();
  await expect(
    page.getByText("Your first completed session will appear here.")
  ).toBeVisible();
});

test("downloaded backup can restore the exact earlier local state", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__settledsoloDownloadText", {
      configurable: true,
      writable: true,
      value: ""
    });
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (value: Blob | MediaSource) => {
      if (value instanceof Blob) {
        void value.text().then((text) => {
          const state = window as typeof window & {
            __settledsoloDownloadText: string;
          };
          state.__settledsoloDownloadText = text;
        });
      }
      return originalCreateObjectURL(value);
    };
  });

  await completeSetup(page, 5);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "Download backup" }).click();

  await expect.poll(() =>
    page.evaluate(() => {
      const state = window as typeof window & {
        __settledsoloDownloadText: string;
      };
      return state.__settledsoloDownloadText;
    })
  ).not.toBe("");

  const backupText = await page.evaluate(() => {
    const state = window as typeof window & {
      __settledsoloDownloadText: string;
    };
    return state.__settledsoloDownloadText;
  });

  await page.getByLabel("Track name", { exact: true }).fill("Changed after backup");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("Changed after backup");

  await page.getByLabel("Choose backup file").setInputFiles({
    name: "downloaded-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupText)
  });
  await expect(page.getByText("Ready to restore Mabel")).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();

  await page.getByRole("button", { name: "More" }).click();
  await expect(page.getByLabel("Track name", { exact: true })).toHaveValue("Separation training");
  await expect(page.getByText("Changed after backup")).toHaveCount(0);
});
