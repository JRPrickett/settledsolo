import { readFileSync } from "node:fs";

/**
 * The two app deployments are intentionally separate Workers. The analytics
 * Worker has its own Wrangler project and must never be targeted by these
 * scripts.
 */
export const DEPLOYMENT_WORKERS = Object.freeze({
  production: Object.freeze({
    config: "wrangler.app.jsonc",
    name: "settledsolo",
  }),
  preview: Object.freeze({
    config: "wrangler.preview.jsonc",
    name: "settledsolo-web-preview",
  }),
});

export function readDeploymentConfig(target) {
  const expected = DEPLOYMENT_WORKERS[target];
  if (!expected) throw new Error("Choose preview or production.");
  return JSON.parse(readFileSync(expected.config, "utf8"));
}

export function assertWorkerIdentity(target, config) {
  const expected = DEPLOYMENT_WORKERS[target];
  if (!expected) throw new Error("Choose preview or production.");

  if (config?.name !== expected.name) {
    throw new Error(
      `${target} deployment must target Worker "${expected.name}"; ` +
        `config targets "${config?.name ?? "(missing)"}".`,
    );
  }
}
