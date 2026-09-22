import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../js/app.js",import.meta.url),"utf8");

assert.match(
  app,
  /createStorage,\s*makeId,\s*intIn,\s*textIn,\s*validOutcome,\s*normaliseState/,
  "The session editor must import validOutcome before its submit handler uses it."
);

// The retired product-event pipeline must not creep back into the legacy app.
assert.doesNotMatch(app,/createAnalytics|ANALYTICS_CONFIG|analytics\.track/);

console.log("app-wiring.test.js passed");
