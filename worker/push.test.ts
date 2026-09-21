import { describe, expect, it } from "vitest";
import {
  createVapidAuthorization,
  handlePushApi,
  type PushEnv
} from "./push";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function makeVapidKeys() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const x = Buffer.from(publicJwk.x!, "base64url");
  const y = Buffer.from(publicJwk.y!, "base64url");
  return {
    publicKey: base64Url(new Uint8Array(Buffer.concat([Buffer.from([4]), x, y]))),
    privateKey: privateJwk.d!
  };
}

function request(
  origin: string,
  path: string,
  body?: unknown,
  requestOrigin = origin
) {
  return new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: requestOrigin,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe("background return push", () => {
  it("creates a VAPID authorization token for a push endpoint", async () => {
    const keys = await makeVapidKeys();
    const authorization = await createVapidAuthorization(
      "https://web.push.apple.com/Q2-example",
      {
        SITE_URL: "https://settledsolo.com",
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey
      },
      Date.UTC(2026, 8, 20, 8, 0, 0)
    );

    expect(authorization).toMatch(/^vapid t=[^.]+\.[^.]+\.[^,]+, k=/);
    expect(authorization).toContain(keys.publicKey);
  });

  it("fails closed when push is not configured", async () => {
    const response = await handlePushApi(
      request("https://settledsolo.test", "/api/push/config"),
      {}
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, publicKey: null });

    const schedule = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", {
        clientId: "client_1234567890123456",
        sessionToken: "session_123456789012345",
        endpoint: "https://web.push.apple.com/example",
        targetAt: Date.now() + 10_000
      }),
      {}
    );
    expect(schedule.status).toBe(503);
  });

  it("validates same-origin scheduling and forwards only approved push hosts", async () => {
    const keys = await makeVapidKeys();
    const forwarded: Request[] = [];
    const namespace = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          forwarded.push(new Request(input, init));
          return new Response(null, { status: 204 });
        }
      })
    } as unknown as DurableObjectNamespace;

    const env: PushEnv = {
      SITE_URL: "https://settledsolo.test",
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      RETURN_ALERTS: namespace
    };
    const body = {
      clientId: "client_1234567890123456",
      sessionToken: "session_123456789012345",
      endpoint: "https://web.push.apple.com/Q2-example",
      targetAt: Date.now() + 10_000
    };

    const crossOrigin = await handlePushApi(
      request(
        "https://settledsolo.test",
        "/api/push/schedule",
        body,
        "https://evil.test"
      ),
      env
    );
    expect(crossOrigin.status).toBe(403);

    const badEndpoint = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", {
        ...body,
        endpoint: "https://example.com/push"
      }),
      env
    );
    expect(badEndpoint.status).toBe(400);

    const endpointWithCredentials = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", {
        ...body,
        endpoint: "https://user:password@web.push.apple.com/Q2-example"
      }),
      env
    );
    expect(endpointWithCredentials.status).toBe(400);

    const endpointWithPort = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", {
        ...body,
        endpoint: "https://web.push.apple.com:8443/Q2-example"
      }),
      env
    );
    expect(endpointWithPort.status).toBe(400);

    const scheduled = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", body),
      env
    );
    expect(scheduled.status).toBe(202);
    expect(forwarded).toHaveLength(1);
    expect(new URL(forwarded[0].url).pathname).toBe("/schedule");

    const payload = (await forwarded[0].json()) as Record<string, unknown>;
    expect(payload).toEqual({
      endpoint: body.endpoint,
      sessionToken: body.sessionToken,
      targetAt: Math.floor(body.targetAt)
    });
  });

  it("rate-limits alert requests before reading private payloads", async () => {
    const keys = await makeVapidKeys();
    const rateLimitKeys: string[] = [];
    const response = await handlePushApi(
      request("https://settledsolo.test", "/api/push/schedule", {
        private: "payload must not be needed for an IP limit"
      }),
      {
        SITE_URL: "https://settledsolo.test",
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        RETURN_ALERTS: {} as DurableObjectNamespace,
        PUSH_RATE_LIMITER: {
          limit: async ({ key }) => {
            rateLimitKeys.push(key);
            return { success: false };
          }
        } as RateLimit
      }
    );

    expect(response.status).toBe(429);
    expect(rateLimitKeys).toEqual(["/api/push/schedule:unknown"]);
  });
});
