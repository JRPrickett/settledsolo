import { readFileSync, writeFileSync } from "node:fs";

const ID_PATTERN = /^[a-f0-9-]{36}$/i;

export const ACCOUNT_TARGETS = ["preview", "production"];

export function accountConfigPath(target) {
  return target === "preview" ? "wrangler.preview.jsonc" : "wrangler.app.jsonc";
}

function readWorkerConfig(target) {
  return JSON.parse(readFileSync(accountConfigPath(target), "utf8"));
}

function exactHttpsOrigin(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.origin !== value) return null;
  return url.origin;
}

/**
 * Every reason this target cannot enable accounts, in the order a reader should
 * fix them. An empty array means the configuration is complete. Messages never
 * contain a secret value, so they are safe to print in workflow logs.
 */
export function accountConfigProblems(target, env = process.env, config) {
  if (!ACCOUNT_TARGETS.includes(target)) return ["Choose preview or production."];
  const worker = config ?? readWorkerConfig(target);
  const problems = [];

  const db =
    target === "preview"
      ? env.ACCOUNTS_PREVIEW_D1_ID
      : env.ACCOUNTS_PRODUCTION_D1_ID;
  const other =
    target === "preview"
      ? env.ACCOUNTS_PRODUCTION_D1_ID
      : env.ACCOUNTS_PREVIEW_D1_ID;

  if (!db || !ID_PATTERN.test(db))
    problems.push(
      "Set the target account D1 database ID before enabling accounts.",
    );
  if (!other || !ID_PATTERN.test(other) || db === other)
    problems.push(
      "Set distinct preview and production account D1 IDs before enabling accounts.",
    );

  const origin = exactHttpsOrigin(env.AUTH_ORIGIN);
  if (!origin)
    problems.push(
      "AUTH_ORIGIN must be an exact HTTPS origin, without a trailing slash.",
    );
  else {
    const site = new URL(worker.vars.SITE_URL).origin;
    if (target === "preview" && origin === site)
      problems.push("Preview auth cannot use the production origin.");
    if (target === "production" && origin !== site)
      problems.push("Production auth must use SITE_URL.");
  }

  if (!env.AUTH_EMAIL_FROM)
    problems.push("Set AUTH_EMAIL_FROM to a verified sender address.");
  if (!env.RESEND_API_KEY)
    problems.push("Set RESEND_API_KEY for the verified sending domain.");
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32)
    problems.push(
      "Set BETTER_AUTH_SECRET to at least 32 random characters, different per environment.",
    );

  return problems;
}

export function accountConfig(target, env = process.env) {
  if (!ACCOUNT_TARGETS.includes(target))
    throw new Error("Choose preview or production.");
  const config = readWorkerConfig(target);
  config.vars.ACCOUNTS_ENABLED = "false";
  if (env.ACCOUNTS_ENABLED !== "true") return config;

  const problems = accountConfigProblems(target, env, config);
  if (problems.length) throw new Error(problems.join(" "));

  config.vars = {
    ...config.vars,
    ACCOUNTS_ENABLED: "true",
    AUTH_ORIGIN: exactHttpsOrigin(env.AUTH_ORIGIN),
    AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
  };
  config.d1_databases = [
    {
      binding: "ACCOUNTS_DB",
      database_name: `settledsolo-accounts-${target}`,
      database_id:
        target === "preview"
          ? env.ACCOUNTS_PREVIEW_D1_ID
          : env.ACCOUNTS_PRODUCTION_D1_ID,
      migrations_dir: "migrations/accounts",
    },
  ];
  config.ratelimits = [
    {
      name: "ACCOUNT_RATE_LIMITER",
      namespace_id: target === "preview" ? "17001" : "17002",
      simple: { limit: 60, period: 60 },
    },
  ];
  return config;
}

export function writeAccountConfig(target) {
  const path = `.wrangler-accounts-${target}.jsonc`;
  writeFileSync(path, JSON.stringify(accountConfig(target), null, 2));
  return path;
}
