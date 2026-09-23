// Captures real SettledSolo screens for the public homepage from the actual app,
// using a sample dog and history, so marketing never shows a mocked-up UI that
// drifts from the product.
//
//   npm run product:screens
//
// Starts its own Vite dev server. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use a
// pre-installed Chromium. The JPEGs are committed; CI never renders them.
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "app-v2", "public", "screens");
const PORT = 4191;
const DAY = 24 * 60 * 60 * 1000;
// Pixel profile: no iOS install banner, so screens show only the product.
const PHONE = { ...devices["Pixel 7"], viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 };

function session(id, daysAgo, targetSeconds, overrides = {}) {
  return {
    id,
    at: Date.now() - daysAgo * DAY,
    targetSeconds,
    actualSeconds: targetSeconds,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note: "",
    ...overrides
  };
}

// A believable recent history: steady progress with one easier day after concern.
const SESSIONS = [
  session("s1", 9, 45),
  session("s2", 8, 45),
  session("s3", 8, 50),
  session("s4", 7, 55, { outcome: "concern", signals: ["exit-watching"] }),
  session("s5", 6, 50),
  session("s6", 5, 50),
  session("s7", 4, 53),
  session("s8", 3, 56),
  session("s9", 2, 59),
  session("s10", 1, 62)
];

async function seed(page) {
  await page.goto(`http://127.0.0.1:${PORT}/app/`);
  await page.getByLabel("Your dog's name").fill("Biscuit");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Comfortable duration").fill("45");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await page.getByRole("button", { name: "Start today's session" }).waitFor();
  await page.evaluate(async (sessions) => {
    const db = await new Promise((resolveDb, reject) => {
      const request = indexedDB.open("dog-training-app", 1);
      request.onsuccess = () => resolveDb(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("records", "readwrite");
    const store = transaction.objectStore("records");
    const request = store.get("app-data");
    request.onsuccess = () => {
      const record = request.result;
      record.value.scenarios[0].label = "Front door";
      record.value.scenarios[0].sessions = sessions;
      store.put({ ...record, updatedAt: Date.now() });
    };
    await new Promise((done, reject) => {
      transaction.oncomplete = () => done();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
    // Keep the fallback copy in step so the newer-copy rule does not restore an older one.
    localStorage.removeItem("dog-training-app.fallback.savedAt.v1");
  }, SESSIONS);
  await page.reload();
  await page.getByRole("button", { name: "Start today's session" }).waitFor();
}

async function capture(page, file) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 82 });
  console.log(`Rendered app-v2/public/screens/${file}`);
}

const server = await createServer({
  configFile: join(root, "app-v2", "vite.config.ts"),
  root: join(root, "app-v2"),
  logLevel: "warn",
  server: { host: "127.0.0.1", port: PORT, strictPort: true }
});
await server.listen();

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
});
try {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.clock.install();
  await seed(page);

  // 1. Today: the plan, its reason and the warm-ups.
  await capture(page, "today.jpg");

  // 2. The live departure, part-way through.
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByLabel("Warm-up count").fill("0");
  await page.getByRole("button", { name: "Save track changes" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Start today's session" }).click();
  await page.getByRole("button", { name: "I'm leaving now" }).click();
  await page.clock.fastForward(24_000);
  await capture(page, "live.jpg");

  // 3. The review after returning.
  await page.clock.fastForward(40_000);
  await page.getByRole("button", { name: "I'm back" }).click();
  await page.getByRole("button", { name: /Relaxed/ }).click();
  await capture(page, "review.jpg");
} finally {
  await browser.close();
  await server.close();
}
