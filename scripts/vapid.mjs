import { generateKeyPairSync } from "node:crypto";

export function createVapidPair() {
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

export function hasCompleteVapidPair(secretList) {
  const names = new Set(
    Array.isArray(secretList)
      ? secretList
          .map((entry) =>
            entry && typeof entry.name === "string" ? entry.name : "",
          )
          .filter(Boolean)
      : [],
  );

  return names.has("VAPID_PUBLIC_KEY") && names.has("VAPID_PRIVATE_KEY");
}
