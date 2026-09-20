import { createVapidPair } from "./vapid.mjs";

const pair = createVapidPair();
console.log("VAPID_PUBLIC_KEY=" + pair.VAPID_PUBLIC_KEY);
console.log("VAPID_PRIVATE_KEY=" + pair.VAPID_PRIVATE_KEY);
console.log(
  "\nKeep the private key secret and keep this pair stable for the environment.",
);
