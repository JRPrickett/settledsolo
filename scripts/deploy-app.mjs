import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeAccountConfig } from "./account-config.mjs";

const target = process.argv[2];
const config = writeAccountConfig(target);

const run = (args) => {
  const result = spawnSync("npx", ["wrangler", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Deployment step failed.");
};

const capture = (args) => {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error("Deployment inspection step failed.");
  }
  return result.stdout;
};

function createVapidPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });
  if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
    throw new Error("Could not generate VAPID key material.");
  }

  const uncompressed = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(publicJwk.x, "base64url"),
    Buffer.from(publicJwk.y, "base64url"),
  ]);

  return {
    VAPID_PUBLIC_KEY: uncompressed.toString("base64url"),
    VAPID_PRIVATE_KEY: privateJwk.d,
  };
}

function ensurePushSecrets(temporary) {
  const listed = JSON.parse(
    capture(["secret", "list", "--format", "json", "--config", config]),
  );
  const names = new Set(
    Array.isArray(listed)
      ? listed
          .map((entry) => (entry && typeof entry.name === "string" ? entry.name : ""))
          .filter(Boolean)
      : [],
  );

  if (names.has("VAPID_PUBLIC_KEY") && names.has("VAPID_PRIVATE_KEY")) {
    console.log("Background-return VAPID keys are already configured.");
    return;
  }

  // The pair is generated only when one or both values are absent. Wrangler
  // leaves secrets not included in a bulk update untouched, and subsequent
  // deployments therefore keep this key pair stable for existing subscriptions.
  const pushSecrets = join(temporary, "push-secrets.json");
  writeFileSync(pushSecrets, JSON.stringify(createVapidPair()), { mode: 0o600 });
  run(["secret", "bulk", pushSecrets, "--config", config]);
  console.log("Configured a stable VAPID key pair for background return alerts.");
}

const temporary = mkdtempSync(join(tmpdir(), "settledsolo-deploy-"));

try {
  if (process.env.ACCOUNTS_ENABLED === "true") {
    run([
      "d1",
      "migrations",
      "apply",
      "ACCOUNTS_DB",
      "--remote",
      "--config",
      config,
    ]);
    const secrets = join(temporary, "secrets.json");
    writeFileSync(
      secrets,
      JSON.stringify({
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
      }),
      { mode: 0o600 },
    );
    run(["secret", "bulk", secrets, "--config", config]);
  }

  // Deploy first so a brand-new target exists before its VAPID secrets are
  // inspected/provisioned. Secret bulk creates a new Worker version containing
  // the same script plus the generated bindings.
  run(["deploy", "--config", config]);
  ensurePushSecrets(temporary);
} finally {
  rmSync(temporary, { recursive: true, force: true });
  rmSync(config, { force: true });
}
