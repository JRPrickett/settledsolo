import { pathToFileURL } from "node:url";

const has = (headers, name, value) =>
  (headers.get(name) ?? "").toLowerCase().includes(value);

/**
 * Checks the deployed /api/account/status response. `expectAvailable` is what
 * the deployment claimed it would do, so a silently disabled activation fails
 * instead of looking like a success.
 */
export function evaluateStatusProbe(probe, expectAvailable) {
  const problems = [];
  if (probe.status !== 200)
    problems.push(`/api/account/status returned HTTP ${probe.status}.`);
  if (typeof probe.body?.available !== "boolean")
    problems.push("/api/account/status did not return an availability flag.");
  else if (probe.body.available !== expectAvailable)
    problems.push(
      expectAvailable
        ? "Accounts were deployed as enabled but the Worker reports them unavailable."
        : "Accounts report as available although this deployment did not enable them.",
    );
  if (!has(probe.headers, "cache-control", "no-store"))
    problems.push("Account responses must not be cacheable.");
  if (!has(probe.headers, "x-robots-tag", "noindex"))
    problems.push("Account responses must be noindexed.");
  return problems;
}

/** An unknown API path must stay JSON rather than falling through to the SPA. */
export function evaluateFallthroughProbe(probe) {
  const problems = [];
  if (probe.status === 200)
    problems.push("An unknown API path returned a success response.");
  if (!(probe.contentType ?? "").includes("application/json"))
    problems.push(
      `An unknown API path returned ${probe.contentType || "no content type"} instead of JSON.`,
    );
  return problems;
}

async function probe(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  return {
    status: response.status,
    headers: response.headers,
    contentType,
    body: contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : null,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const origin = process.argv[2];
  if (!origin?.startsWith("https://"))
    throw new Error("Pass the deployed HTTPS origin to verify.");
  const expectAvailable = process.env.ACCOUNTS_ENABLED === "true";

  const status = await probe(`${origin}/api/account/status`);
  const unknown = await probe(`${origin}/api/not-a-real-endpoint`);
  const problems = [
    ...evaluateStatusProbe(status, expectAvailable),
    ...evaluateFallthroughProbe(unknown),
  ];

  console.log(`Account endpoint check: ${origin}`);
  console.log(
    `- accounts available: ${status.body?.available ?? "unknown"} (expected ${expectAvailable})`,
  );
  console.log(`- unknown API path: HTTP ${unknown.status} ${unknown.contentType}`);
  for (const problem of problems) console.log(`- ${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log("- all checks passed");
}
