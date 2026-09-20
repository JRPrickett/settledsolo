function base64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

const x = Buffer.from(publicJwk.x, "base64url");
const y = Buffer.from(publicJwk.y, "base64url");
const publicKey = base64Url(
  Buffer.concat([Buffer.from([4]), x, y])
);

console.log("VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + privateJwk.d);
console.log(
  "\nKeep the private key secret and keep this pair stable for the environment."
);
