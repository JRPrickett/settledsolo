import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEPLOYMENT_WORKERS,
  assertWorkerIdentity,
  readDeploymentConfig,
} from "./worker-config.mjs";

test("production config targets the live SettledSolo Worker", () => {
  const config = readDeploymentConfig("production");

  assertWorkerIdentity("production", config);
  assert.equal(config.routes?.[0]?.pattern, "settledsolo.com");
  assert.equal(config.routes?.[0]?.custom_domain, true);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
});

test("preview config remains isolated from production", () => {
  const config = readDeploymentConfig("preview");

  assertWorkerIdentity("preview", config);
  assert.notEqual(config.name, DEPLOYMENT_WORKERS.production.name);
});

test("a stale Worker name is rejected before deployment", () => {
  assert.throws(
    () => assertWorkerIdentity("production", { name: "settledsolo-web" }),
    /must target Worker "settledsolo"/,
  );
});
