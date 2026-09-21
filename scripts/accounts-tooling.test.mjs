import { test } from "node:test";
import assert from "node:assert/strict";
import { preflightReport } from "./accounts-preflight.mjs";
import {
  evaluateStatusProbe,
  evaluateFallthroughProbe,
  verifyWithRetry,
} from "./accounts-verify.mjs";
import { createVapidPair, hasCompleteVapidPair } from "./vapid.mjs";

const secret = "test-only-at-least-thirty-two-character-secret";
const apiKey = "test-only-resend-key";
const ready = {
  ACCOUNTS_ENABLED: "true",
  ACCOUNTS_PREVIEW_D1_ID: "11111111-1111-4111-8111-111111111111",
  ACCOUNTS_PRODUCTION_D1_ID: "22222222-2222-4222-8222-222222222222",
  AUTH_ORIGIN: "https://preview.example.test",
  AUTH_EMAIL_FROM: "SettledSolo <login@example.test>",
  BETTER_AUTH_SECRET: secret,
  RESEND_API_KEY: apiKey,
};

test("preflight lists every outstanding item at once", () => {
  const report = preflightReport("preview", {});
  assert.equal(report.ready, false);
  assert.equal(report.enabled, false);
  assert.equal(report.problems.length, 6);
});

test("preflight never reports a secret value", () => {
  const text = preflightReport("preview", ready).lines.join("\n");
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(apiKey), false);
  assert.match(text, /BETTER_AUTH_SECRET: present/);
});

test("an unconfigured deployment stays safe rather than failing", () => {
  const report = preflightReport("production", {});
  assert.equal(report.enabled && !report.ready, false);
});

test("an incomplete activation is a deployment failure", () => {
  const report = preflightReport("preview", {
    ...ready,
    BETTER_AUTH_SECRET: "too-short",
  });
  assert.equal(report.enabled && !report.ready, true);
});

test("a complete configuration names the bound database and origin", () => {
  const text = preflightReport("preview", ready).lines.join("\n");
  assert.match(text, /settledsolo-accounts-preview/);
  assert.match(text, /https:\/\/preview\.example\.test/);
});

test("production cannot be activated against a preview origin", () => {
  assert.equal(preflightReport("production", ready).ready, false);
});

const privateHeaders = new Headers({
  "cache-control": "no-store, private",
  "x-robots-tag": "noindex, nofollow",
});

test("a healthy disabled deployment passes verification", () => {
  assert.deepEqual(
    evaluateStatusProbe(
      { status: 200, headers: privateHeaders, body: { available: false } },
      false,
    ),
    [],
  );
});

test("verification fails when an enabled deployment reports accounts off", () => {
  const problems = evaluateStatusProbe(
    { status: 200, headers: privateHeaders, body: { available: false } },
    true,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unavailable/);
});

test("account responses must stay private and unindexed", () => {
  const problems = evaluateStatusProbe(
    { status: 200, headers: new Headers(), body: { available: true } },
    true,
  );
  assert.equal(problems.length, 2);
});

test("an unknown API path must not fall through to the app shell", () => {
  assert.equal(
    evaluateFallthroughProbe({ status: 200, contentType: "text/html" }).length,
    2,
  );
  assert.deepEqual(
    evaluateFallthroughProbe({ status: 503, contentType: "application/json" }),
    [],
  );
});

test("deployment verification retries while the previous Worker is still served", async () => {
  let statusCalls = 0;
  let sleeps = 0;

  const result = await verifyWithRetry("https://preview.example.test", true, {
    attempts: 3,
    delayMs: 1,
    sleepFn: async () => {
      sleeps += 1;
    },
    probeFn: async (url) => {
      if (url.endsWith("/api/account/status")) {
        statusCalls += 1;
        return {
          status: 200,
          headers: privateHeaders,
          contentType: "application/json",
          body: { available: statusCalls >= 3 },
        };
      }

      return {
        status: 503,
        headers: privateHeaders,
        contentType: "application/json",
        body: { error: "not found" },
      };
    },
  });

  assert.equal(statusCalls, 3);
  assert.equal(sleeps, 2);
  assert.equal(result.attempt, 3);
  assert.deepEqual(result.problems, []);
});


test("VAPID provisioning creates valid URL-safe P-256 key material", () => {
  const pair = createVapidPair();
  const publicKey = Buffer.from(pair.VAPID_PUBLIC_KEY, "base64url");
  const privateKey = Buffer.from(pair.VAPID_PRIVATE_KEY, "base64url");

  assert.equal(publicKey.length, 65);
  assert.equal(publicKey[0], 4);
  assert.equal(privateKey.length, 32);
  assert.match(pair.VAPID_PUBLIC_KEY, /^[A-Za-z0-9_-]+$/);
  assert.match(pair.VAPID_PRIVATE_KEY, /^[A-Za-z0-9_-]+$/);
});

test("VAPID deployment only preserves a complete existing pair", () => {
  assert.equal(
    hasCompleteVapidPair([
      { name: "VAPID_PUBLIC_KEY" },
      { name: "VAPID_PRIVATE_KEY" },
      { name: "OTHER_SECRET" },
    ]),
    true,
  );
  assert.equal(hasCompleteVapidPair([{ name: "VAPID_PUBLIC_KEY" }]), false);
  assert.equal(hasCompleteVapidPair(null), false);
});
