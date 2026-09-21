import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import { createAuth, otpRateLimitKey, type AccountEnv } from "./auth";
import { handleAccountApi } from "./api";
import { sync } from "./sync";
let mf: Miniflare;
let db: D1Database;
let env: AccountEnv;
const codes = new Map<string, string>();
let auth: ReturnType<typeof createAuth>;
const origin = "https://preview.settledsolo.test";
const req = (path: string, body?: unknown, cookie?: string, source = origin) =>
  new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: source,
      "Content-Type": "application/json",
      "cf-connecting-ip": "192.0.2.1",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function login(email: string) {
  const response = await handleAccountApi(
    req("/api/auth/email-otp/send-verification-otp", {
      email,
      type: "sign-in",
    }),
    env,
    auth,
  );
  expect(response.status).toBe(200);
  const code = codes.get(email)!;
  const logged = await handleAccountApi(
    req("/api/auth/sign-in/email-otp", { email, otp: code }),
    env,
    auth,
  );
  expect(logged.status).toBe(200);
  expect(logged.headers.get("set-cookie")).toContain("HttpOnly");
  expect(logged.headers.get("set-cookie")).toContain("Secure");
  const cookie = logged.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const result = (await logged.json()) as { user: { id: string } };
  return { cookie, userId: result.user.id, code };
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "accounts-test",
          modules: true,
          script: "export default {fetch(){return new Response('ok')}}",
          compatibilityDate: "2026-09-18",
          d1Databases: ["ACCOUNTS_DB"],
        },
      ],
    }),
  );
  db = (await mf.getD1Database("ACCOUNTS_DB")) as unknown as D1Database;
  for (const path of [
    "migrations/accounts/0001_auth.sql",
    "migrations/accounts/0002_sync.sql",
  ]) {
    for (const sql of readFileSync(path, "utf8")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
  env = {
    ACCOUNTS_DB: db,
    ACCOUNTS_ENABLED: "true",
    AUTH_ORIGIN: origin,
    BETTER_AUTH_SECRET: "test-only-secret-of-at-least-thirty-two-characters",
    RESEND_API_KEY: "test-only",
    AUTH_EMAIL_FROM: "test@example.test",
  };
  auth = createAuth(env, async (email, code) => {
    codes.set(email, code);
  });
});
afterAll(async () => {
  await mf?.dispose();
});
describe("account API on real local D1", () => {
  it("fails closed without configuration and rejects cross-origin writes", async () => {
    expect((await handleAccountApi(req("/api/sync", {}), {})).status).toBe(503);
    expect(
      (
        await handleAccountApi(
          req("/api/sync", {}, undefined, "https://evil.test"),
          env,
          auth,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleAccountApi(
          req("/api/sync", { cursor: 0, operations: [] }),
          env,
          auth,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleAccountApi(
          new Request(`${origin}/api/auth/get-session`, {
            method: "POST",
            headers: { origin, "Content-Type": "application/json" },
            body: "{}",
          }),
          env,
          auth,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handleAccountApi(
          new Request(
            `${origin}/api/auth/email-otp/send-verification-otp`,
            {
              method: "POST",
              headers: { origin, "Content-Type": "text/plain" },
              body: "not json",
            },
          ),
          env,
          auth,
        )
      ).status,
    ).toBe(400);
  });
  it("signs in by OTP, rejects reuse, syncs idempotently, isolates users and deletes cloud data", async () => {
    const a = await login("a@example.test");
    const b = await login("b@example.test");
    const reused = await handleAccountApi(
      req("/api/auth/sign-in/email-otp", {
        email: "a@example.test",
        otp: a.code,
      }),
      env,
      auth,
    );
    expect(reused.status).not.toBe(200);
    const op = {
      id: crypto.randomUUID(),
      key: "profile:primary",
      base: 0,
      value: { kind: "profile", dogId: "primary", dogName: "Mabel" },
    };
    const first = await sync(db, a.userId, { cursor: 0, operations: [op] });
    const otherResponse = await handleAccountApi(
      req(
        "/api/sync",
        { cursor: 0, operations: [], accountId: b.userId },
        b.cookie,
      ),
      env,
      auth,
    );
    expect(
      ((await otherResponse.json()) as { changes: unknown[] }).changes,
    ).toHaveLength(0);
    const forged = await handleAccountApi(
      req(
        "/api/sync",
        { cursor: 0, operations: [], accountId: b.userId, userId: a.userId },
        b.cookie,
      ),
      env,
      auth,
    );
    expect(forged.status).toBe(400);
    const retry = await sync(db, a.userId, { cursor: 0, operations: [op] });
    expect(retry.accepted).toEqual(first.accepted);
    expect(retry.changes).toHaveLength(1);
    expect(
      (await sync(db, b.userId, { cursor: 0, operations: [] })).changes,
    ).toHaveLength(0);
    const concurrent = {
      ...op,
      id: crypto.randomUUID(),
      value: { ...op.value, dogName: "Changed" },
    };
    expect(
      (await sync(db, a.userId, { cursor: 0, operations: [concurrent] }))
        .conflicts,
    ).toHaveLength(1);
    const deletion = {
      id: crypto.randomUUID(),
      key: op.key,
      base: first.accepted[0].revision,
      value: null,
    };
    const deleted = await sync(db, a.userId, {
      cursor: first.cursor,
      operations: [deletion],
    });
    expect(deleted.changes[0].value).toBeNull();
    const wrongAccountDelete = await handleAccountApi(
      req(
        "/api/account/delete",
        { confirmation: "DELETE", accountId: a.userId },
        b.cookie,
      ),
      env,
      auth,
    );
    expect(wrongAccountDelete.status).toBe(409);
    const staleSync = await handleAccountApi(
      req(
        "/api/sync",
        { cursor: 0, operations: [op], accountId: a.userId },
        b.cookie,
      ),
      env,
      auth,
    );
    expect(staleSync.status).toBe(409);
    const exported = await handleAccountApi(
      req(`/api/account/export?accountId=${a.userId}`, undefined, a.cookie),
      env,
      auth,
    );
    expect(exported.status).toBe(200);
    expect(exported.headers.get("cache-control")).toContain("no-store");
    const exportedData = (await exported.json()) as {
      changeHistory: unknown[];
    };
    expect(exportedData.changeHistory).toHaveLength(2);
    const result = await handleAccountApi(
      req(
        "/api/account/delete",
        { confirmation: "DELETE", accountId: a.userId },
        a.cookie,
      ),
      env,
      auth,
    );
    expect(result.status).toBe(200);
    expect(
      await db
        .prepare("SELECT COUNT(*) AS n FROM sync_changes WHERE user_id=?")
        .bind(a.userId)
        .first("n"),
    ).toBe(0);
    expect(
      (
        await handleAccountApi(
          req("/api/sync", { cursor: 0, operations: [] }, a.cookie),
          env,
          auth,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleAccountApi(
          req("/api/auth/sign-out", {}, b.cookie),
          env,
          auth,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await handleAccountApi(
          req(
            "/api/sync",
            { cursor: 0, operations: [], accountId: b.userId },
            b.cookie,
          ),
          env,
          auth,
        )
      ).status,
    ).toBe(401);
  });
  it("bounds payloads and rate-limits code requests", async () => {
    const oversized = req("/api/auth/email-otp/send-verification-otp", {
      email: "x".repeat(530000),
      type: "sign-in",
    });
    expect((await handleAccountApi(oversized, env, auth)).status).toBe(413);
    const response = await handleAccountApi(
      req("/api/auth/email-otp/send-verification-otp", {
        email: "c@example.test",
        type: "sign-in",
      }),
      env,
      auth,
    );
    expect(response.status).toBe(200);
    const limited = await handleAccountApi(
      req("/api/auth/email-otp/send-verification-otp", {
        email: "d@example.test",
        type: "sign-in",
      }),
      env,
      auth,
    );
    expect(limited.status).toBe(429);
  });

  it("rate-limits OTP delivery with an opaque normalized email key", async () => {
    const keys: string[] = [];
    const otpEnv: AccountEnv = {
      ...env,
      OTP_RATE_LIMITER: {
        limit: async ({ key }) => {
          keys.push(key);
          return { success: false };
        },
      } as RateLimit,
    };
    const response = await handleAccountApi(
      req("/api/auth/email-otp/send-verification-otp", {
        email: "CaseSensitive@example.test",
        type: "sign-in",
      }),
      otpEnv,
      auth,
    );

    expect(response.status).toBe(429);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(keys[0]).not.toContain("example.test");
    expect(keys[0]).toBe(
      await otpRateLimitKey(
        "  casesensitive@EXAMPLE.TEST  ",
        env.BETTER_AUTH_SECRET!,
      ),
    );
  });
});
