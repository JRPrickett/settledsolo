import { expect, test } from "@playwright/test";
import { cloud, setup, signIn } from "./accountHelpers";
test("onboarding waits for the session check and hides the account prompt when signed in", async ({
  page,
  context,
}) => {
  const server = cloud();
  const state = await server.attach(context);
  state.signedIn = true;
  let release!: () => void;
  state.sessionHold = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.goto("/app/");
  await expect(page.getByLabel("Your dog's name")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in or create a free account" }),
  ).toHaveCount(0);

  const sessionResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/get-session"),
  );
  release();
  await sessionResponse;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );
  await expect(
    page.getByRole("button", { name: "Sign in or create a free account" }),
  ).toHaveCount(0);
});
test("account import is explicit, controls fit mobile, and sign-out prevents account mixing", async ({
  page,
  context,
}, info) => {
  const server = cloud();
  const state = await server.attach(context);
  await setup(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in or create a free account" }),
  ).toBeVisible();
  await expect(page.getByText(/No password needed/)).toBeVisible();
  await expect(
    page.getByText(/new device or browser needs its own code/),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("account-signin.png"),
    fullPage: true,
  });
  const size = await page
    .getByLabel("Email address")
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  await signIn(page);
  await expect(
    page.getByText("Connect this training log?", { exact: true }),
  ).toBeVisible();
  expect(server.requests).toBe(0);
  await page
    .getByRole("button", { name: "Connect and upload this log" })
    .click();
  await expect(page.getByText(/Last synced/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("account-connected.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  state.account = "different";
  await signIn(page);
  await expect(page.getByText(/log belongs to another account/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect and upload this log" }),
  ).toHaveCount(0);
});
test("offline local save syncs later and restores on a second device without duplicated sessions", async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(60_000);
  const server = cloud();
  const state = await server.attach(context);
  await setup(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await signIn(page);
  await page
    .getByRole("button", { name: "Connect and upload this log" })
    .click();
  await expect(page.getByText(/Last synced/)).toBeVisible();
  state.online = false;
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await page.getByRole("button", { name: "Save session" }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByText(/waiting to sync/)).toBeVisible();
  state.online = true;
  await expect(
    page.getByRole("button", { name: "Sync now", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByText(/waiting to sync/)).toHaveCount(0);
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
  try {
    await server.attach(second);
    const other = await second.newPage();
    await other.goto("/app/");
    await other
      .getByRole("button", { name: "Sign in or create a free account" })
      .click();
    await signIn(other);
    await other
      .getByRole("button", { name: "Restore from my account" })
      .click();
    await expect(other.getByText(/Last synced/)).toBeVisible();
    await other.getByRole("button", { name: "Back to training" }).click();
    await other.getByRole("button", { name: "History", exact: true }).click();
    await expect(other.getByText("Relaxed", { exact: true })).toHaveCount(1);
    await other.reload();
    await other.getByRole("button", { name: "History", exact: true }).click();
    await expect(other.getByText("Relaxed", { exact: true })).toHaveCount(1);
  } finally {
    await second.close();
  }
});

test("a late cloud response cannot change an active training session", async ({
  page,
  context,
}) => {
  const server = cloud();
  const state = await server.attach(context);
  await setup(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await signIn(page);
  await page
    .getByRole("button", { name: "Connect and upload this log" })
    .click();
  await expect(page.getByText(/Last synced/)).toBeVisible();
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.renameDog("Cloud Mabel");
  const before = server.requests;
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect.poll(() => server.requests).toBeGreaterThan(before);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  const response = page.waitForResponse((response) =>
    response.url().endsWith("/api/sync"),
  );
  release();
  await response;
  await page.getByRole("button", { name: "I'm back" }).click();
  await expect(
    page.getByRole("heading", { name: "How was Mabel while you were away?" }),
  ).toBeVisible();
});
