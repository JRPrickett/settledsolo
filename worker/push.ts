import { DurableObject } from "cloudflare:workers";

interface PushSecrets {
  SITE_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}

export interface PushEnv extends PushSecrets {
  RETURN_ALERTS?: DurableObjectNamespace;
}

interface PendingAlert {
  endpoint: string;
  sessionToken: string;
  targetAt: number;
}

type ScheduleInput = PendingAlert & {
  clientId: string;
};

type CancelInput = {
  clientId: string;
  sessionToken: string;
};

const MAX_ALERT_DELAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 8 * 1024;

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normal = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - (normal.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function trimInteger(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  return bytes.slice(start);
}

function normalizeEcdsaSignature(signature: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(signature);
  if (bytes.length === 64) return bytes;

  if (bytes.length < 8 || bytes[0] !== 0x30) {
    throw new Error("Unsupported ECDSA signature format.");
  }

  let offset = 1;
  let sequenceLength = bytes[offset++];
  if (sequenceLength & 0x80) {
    const lengthBytes = sequenceLength & 0x7f;
    sequenceLength = 0;
    for (let index = 0; index < lengthBytes; index += 1) {
      sequenceLength = (sequenceLength << 8) | bytes[offset++];
    }
  }

  if (offset + sequenceLength > bytes.length || bytes[offset++] !== 0x02) {
    throw new Error("Invalid ECDSA signature.");
  }

  const rLength = bytes[offset++];
  const r = trimInteger(bytes.slice(offset, offset + rLength));
  offset += rLength;

  if (bytes[offset++] !== 0x02) throw new Error("Invalid ECDSA signature.");
  const sLength = bytes[offset++];
  const s = trimInteger(bytes.slice(offset, offset + sLength));

  if (r.length > 32 || s.length > 32) {
    throw new Error("Invalid ECDSA signature length.");
  }

  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}

function vapidConfigured(env: PushSecrets): env is PushSecrets & {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
} {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function pushEndpointAllowed(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

function validOpaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 16 &&
    value.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new Error("JSON_REQUIRED");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new Error("JSON_REQUIRED");

  const decoder = new TextDecoder();
  let text = "";
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }

  return JSON.parse(text + decoder.decode());
}

export async function createVapidAuthorization(
  endpoint: string,
  env: PushSecrets,
  now = Date.now()
): Promise<string> {
  if (!vapidConfigured(env)) throw new Error("VAPID_NOT_CONFIGURED");

  const publicKey = base64UrlDecode(env.VAPID_PUBLIC_KEY);
  const privateKey = base64UrlDecode(env.VAPID_PRIVATE_KEY);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04 || privateKey.length !== 32) {
    throw new Error("Invalid VAPID key material.");
  }

  const x = publicKey.slice(1, 33);
  const y = publicKey.slice(33, 65);
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(x),
      y: base64UrlEncode(y),
      d: base64UrlEncode(privateKey),
      ext: true
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const audience = new URL(endpoint).origin;
  const subject =
    env.SITE_URL?.startsWith("https://") ? env.SITE_URL : "https://settledsolo.com";
  const unsigned = `${encodeJson({ typ: "JWT", alg: "ES256" })}.${encodeJson({
    aud: audience,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: subject
  })}`;
  const signature = normalizeEcdsaSignature(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(unsigned)
    )
  );

  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function sendReturnPush(
  pending: PendingAlert,
  env: PushSecrets
): Promise<"sent" | "gone"> {
  const authorization = await createVapidAuthorization(pending.endpoint, env);
  const response = await fetch(pending.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      TTL: "60",
      Urgency: "high",
      Topic: pending.sessionToken.slice(0, 32)
    },
    signal: AbortSignal.timeout(10_000)
  });

  if (response.status === 404 || response.status === 410) return "gone";
  if (!response.ok) throw new Error(`Push service returned ${response.status}`);
  return "sent";
}

export class ReturnAlertScheduler extends DurableObject<PushSecrets> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/schedule" && request.method === "POST") {
      const pending = (await request.json()) as PendingAlert;
      await this.ctx.storage.put("pending", pending);
      await this.ctx.storage.setAlarm(pending.targetAt);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/cancel" && request.method === "POST") {
      const input = (await request.json()) as { sessionToken: string };
      const pending = await this.ctx.storage.get<PendingAlert>("pending");
      if (pending?.sessionToken === input.sessionToken) {
        await this.ctx.storage.delete("pending");
        await this.ctx.storage.deleteAlarm();
      }
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const pending = await this.ctx.storage.get<PendingAlert>("pending");
    if (!pending) return;

    if (pending.targetAt > Date.now() + 250) {
      await this.ctx.storage.setAlarm(pending.targetAt);
      return;
    }

    await sendReturnPush(pending, this.env);
    await this.ctx.storage.delete("pending");
  }
}

export async function handlePushApi(
  request: Request,
  env: PushEnv
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/push/config" && request.method === "GET") {
    return json({
      enabled: Boolean(env.RETURN_ALERTS && vapidConfigured(env)),
      publicKey: vapidConfigured(env) ? env.VAPID_PUBLIC_KEY : null
    });
  }

  if (
    !env.RETURN_ALERTS ||
    !vapidConfigured(env)
  ) {
    return json(
      {
        error:
          "Background return alerts are not configured. The in-app timer still works."
      },
      503
    );
  }

  if (request.method !== "POST") return json({ error: "Not found" }, 404);
  if (request.headers.get("origin") !== url.origin) {
    return json({ error: "Open SettledSolo directly to continue." }, 403);
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return json(
      { error: message === "TOO_LARGE" ? "Request too large." : "Invalid request." },
      message === "TOO_LARGE" ? 413 : 400
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Invalid request." }, 400);
  }

  if (url.pathname === "/api/push/schedule") {
    const input = body as Partial<ScheduleInput>;
    const now = Date.now();
    if (
      !validOpaqueId(input.clientId) ||
      !validOpaqueId(input.sessionToken) ||
      typeof input.endpoint !== "string" ||
      input.endpoint.length > 2048 ||
      !pushEndpointAllowed(input.endpoint) ||
      typeof input.targetAt !== "number" ||
      !Number.isFinite(input.targetAt) ||
      input.targetAt < now + 250 ||
      input.targetAt > now + MAX_ALERT_DELAY_MS
    ) {
      return json({ error: "Invalid return alert." }, 400);
    }

    const stub = env.RETURN_ALERTS.get(
      env.RETURN_ALERTS.idFromName(input.clientId)
    );
    await stub.fetch("https://return-alert.internal/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: input.endpoint,
        sessionToken: input.sessionToken,
        targetAt: Math.floor(input.targetAt)
      } satisfies PendingAlert)
    });
    return json({ scheduled: true }, 202);
  }

  if (url.pathname === "/api/push/cancel") {
    const input = body as Partial<CancelInput>;
    if (!validOpaqueId(input.clientId) || !validOpaqueId(input.sessionToken)) {
      return json({ error: "Invalid return alert." }, 400);
    }

    const stub = env.RETURN_ALERTS.get(
      env.RETURN_ALERTS.idFromName(input.clientId)
    );
    await stub.fetch("https://return-alert.internal/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: input.sessionToken })
    });
    return json({ cancelled: true });
  }

  return json({ error: "Not found" }, 404);
}
