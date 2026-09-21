import { test } from "node:test";
import assert from "node:assert/strict";
import { accountConfig } from "./account-config.mjs";

const env = {
  ACCOUNTS_ENABLED: "true",
  ACCOUNTS_PREVIEW_D1_ID: "11111111-1111-4111-8111-111111111111",
  ACCOUNTS_PRODUCTION_D1_ID: "22222222-2222-4222-8222-222222222222",
  AUTH_ORIGIN: "https://preview.example.test",
  AUTH_EMAIL_FROM: "SettledSolo <login@example.test>",
  BETTER_AUTH_SECRET: "test-only-at-least-thirty-two-character-secret",
  RESEND_API_KEY: "test-only",
};

test("preview accounts remain off with no configuration", () => {
  const config = accountConfig("preview", {});
  assert.equal(config.vars.ACCOUNTS_ENABLED, "false");
  assert.equal(config.d1_databases, undefined);
});

test("production preserves its activated account bindings without GitHub env", () => {
  const config = accountConfig("production", {});

  assert.equal(config.vars.ACCOUNTS_ENABLED, "true");
  assert.equal(config.vars.AUTH_ORIGIN, "https://settledsolo.com");
  assert.equal(
    config.vars.AUTH_EMAIL_FROM,
    "SettledSolo <login@auth.settledsolo.com>",
  );
  assert.equal(
    config.d1_databases.find((database) => database.binding === "ACCOUNTS_DB")
      ?.database_name,
    "settledsolo-accounts-production",
  );
  assert.deepEqual(
    config.ratelimits
      .filter((rateLimit) =>
        ["ACCOUNT_RATE_LIMITER", "OTP_RATE_LIMITER"].includes(rateLimit.name),
      )
      .map((rateLimit) => rateLimit.name)
      .sort(),
    ["ACCOUNT_RATE_LIMITER", "OTP_RATE_LIMITER"],
  );
});

test("production can still be explicitly disabled as an emergency kill switch", () => {
  const config = accountConfig("production", { ACCOUNTS_ENABLED: "false" });
  assert.equal(config.vars.ACCOUNTS_ENABLED, "false");
});

test("preview and production use distinct configured D1 databases", () => {
  const preview = accountConfig("preview", env);
  const production = accountConfig("production", {
    ...env,
    AUTH_ORIGIN: "https://settledsolo.com",
  });

  assert.notEqual(
    preview.d1_databases.find((database) => database.binding === "ACCOUNTS_DB")
      .database_id,
    production.d1_databases.find(
      (database) => database.binding === "ACCOUNTS_DB",
    ).database_id,
  );
  assert.equal(JSON.stringify(preview).includes(env.RESEND_API_KEY), false);

  for (const config of [preview, production]) {
    const names = config.ratelimits.map((rateLimit) => rateLimit.name);
    assert.equal(
      names.filter((name) => name === "ACCOUNT_RATE_LIMITER").length,
      1,
    );
    assert.equal(names.filter((name) => name === "OTP_RATE_LIMITER").length, 1);
  }
});

test("unsafe shared databases, origins or missing secrets prevent account deployment", () => {
  assert.throws(() =>
    accountConfig("preview", {
      ...env,
      ACCOUNTS_PRODUCTION_D1_ID: env.ACCOUNTS_PREVIEW_D1_ID,
    }),
  );
  assert.throws(() =>
    accountConfig("preview", {
      ...env,
      AUTH_ORIGIN: "https://settledsolo.com",
    }),
  );
  assert.throws(() => accountConfig("production", env));
  assert.throws(() =>
    accountConfig("preview", { ...env, BETTER_AUTH_SECRET: "" }),
  );
});
