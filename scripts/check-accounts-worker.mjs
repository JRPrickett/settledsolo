import { writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { accountConfig } from "./account-config.mjs";

/**
 * Proves the accounts-enabled Worker configuration still deploys, so a change
 * to bindings, migrations or the rate limiter fails in CI rather than at
 * activation. Placeholder values only: this never reads real credentials and
 * never contacts Cloudflare beyond a dry run.
 */
const placeholders = {
  ACCOUNTS_ENABLED: "true",
  ACCOUNTS_PREVIEW_D1_ID: "11111111-1111-4111-8111-111111111111",
  ACCOUNTS_PRODUCTION_D1_ID: "22222222-2222-4222-8222-222222222222",
  AUTH_EMAIL_FROM: "SettledSolo <login@example.invalid>",
  BETTER_AUTH_SECRET: "placeholder-secret-of-at-least-thirty-two-characters",
  RESEND_API_KEY: "placeholder",
};

const origins = {
  preview: "https://settledsolo-web-preview.example.invalid",
  production: "https://settledsolo.com",
};

for (const target of ["preview", "production"]) {
  const path = `.wrangler-accounts-check-${target}.jsonc`;
  const config = accountConfig(target, {
    ...placeholders,
    AUTH_ORIGIN: origins[target],
  });
  if (!config.d1_databases?.length)
    throw new Error(`${target} did not bind an account database.`);
  writeFileSync(path, JSON.stringify(config, null, 2));
  try {
    const result = spawnSync(
      "npx",
      ["wrangler", "deploy", "--dry-run", "--config", path],
      { stdio: "inherit" },
    );
    if (result.status !== 0)
      throw new Error(`Accounts-enabled ${target} Worker config is invalid.`);
  } finally {
    rmSync(path, { force: true });
  }
}
