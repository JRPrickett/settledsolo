import { pathToFileURL } from "node:url";

const TARGETS = new Set(["preview", "production"]);
const ID_PATTERN = /^[a-f0-9-]{36}$/i;

export function accountStatsConfig(target, env = process.env) {
  if (!TARGETS.has(target)) throw new Error("Choose preview or production.");

  const databaseId =
    target === "preview"
      ? env.ACCOUNTS_PREVIEW_D1_ID
      : env.ACCOUNTS_PRODUCTION_D1_ID;

  if (!env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required.");
  if (!env.CLOUDFLARE_API_TOKEN)
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  if (!databaseId || !ID_PATTERN.test(databaseId))
    throw new Error(`The ${target} account D1 database ID is missing or invalid.`);

  return {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    databaseId,
  };
}

export function parseRegisteredAccountCount(payload) {
  const value = payload?.result?.[0]?.results?.[0]?.registered_accounts;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0)
    throw new Error("Cloudflare returned an unexpected account-count result.");
  return count;
}

export async function registeredAccountCount(
  target,
  env = process.env,
  fetcher = fetch,
) {
  const config = accountStatsConfig(target, env);
  const response = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: 'SELECT COUNT(*) AS registered_accounts FROM "user"',
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success)
    throw new Error("Could not query the account database; check D1 permissions.");

  return parseRegisteredAccountCount(payload);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const target = process.argv[2];
  const count = await registeredAccountCount(target);
  console.log(`SettledSolo registered accounts (${target}): ${count}`);
}
