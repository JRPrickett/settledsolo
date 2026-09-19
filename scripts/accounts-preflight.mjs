import { pathToFileURL } from "node:url";
import {
  ACCOUNT_TARGETS,
  accountConfig,
  accountConfigProblems,
} from "./account-config.mjs";

/**
 * Names the deployment reads for this target. Values are never reported, only
 * whether something is present, so a report can be pasted into an issue or a
 * workflow summary.
 */
function requiredNames(target) {
  return [
    target === "preview"
      ? "ACCOUNTS_PREVIEW_D1_ID"
      : "ACCOUNTS_PRODUCTION_D1_ID",
    target === "preview"
      ? "ACCOUNTS_PRODUCTION_D1_ID"
      : "ACCOUNTS_PREVIEW_D1_ID",
    "AUTH_ORIGIN",
    "AUTH_EMAIL_FROM",
    "BETTER_AUTH_SECRET",
    "RESEND_API_KEY",
  ];
}

export function preflightReport(target, env = process.env) {
  if (!ACCOUNT_TARGETS.includes(target))
    return {
      enabled: false,
      ready: false,
      problems: ["Choose preview or production."],
      lines: ["Choose preview or production."],
    };

  const enabled = env.ACCOUNTS_ENABLED === "true";
  const problems = accountConfigProblems(target, env);
  const ready = problems.length === 0;
  const lines = [`SettledSolo account preflight: ${target}`, ""];

  lines.push(`ACCOUNTS_ENABLED: ${enabled ? "true" : "not set"}`);
  for (const name of requiredNames(target))
    lines.push(`${name}: ${env[name] ? "present" : "missing"}`);
  lines.push("");

  if (problems.length) {
    lines.push("Outstanding configuration:");
    for (const problem of problems) lines.push(`- ${problem}`);
  } else {
    const config = accountConfig(target, { ...env, ACCOUNTS_ENABLED: "true" });
    lines.push("Configuration is complete. Deployment would bind:");
    lines.push(`- D1 database: ${config.d1_databases[0].database_name}`);
    lines.push(`- Auth origin: ${config.vars.AUTH_ORIGIN}`);
    lines.push(`- Migrations: ${config.d1_databases[0].migrations_dir}`);
  }

  lines.push("");
  if (!enabled)
    lines.push(
      ready
        ? "Accounts stay disabled until ACCOUNTS_ENABLED is set to true for this environment."
        : "Accounts stay disabled. Deployment is safe; guest training is unaffected.",
    );
  else if (!ready) lines.push("Deployment would fail. Fix the items above first.");
  else lines.push("Accounts would be activated by the next deployment.");

  return { enabled, ready, problems, lines };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const report = preflightReport(process.argv[2]);
  console.log(report.lines.join("\n"));
  // Only a deployment that claims to enable accounts is allowed to fail here.
  if (report.enabled && !report.ready) process.exitCode = 1;
}
