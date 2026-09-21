import {
  accountsConfigured,
  createAuth,
  otpRateLimitKey,
  type AccountEnv,
} from "./auth";
import { sync } from "./sync";
import { ZodError } from "zod";
export const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow",
      Vary: "Cookie",
    },
  });
async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("JSON_REQUIRED");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512 * 1024) {
      await reader.cancel();
      throw new Error("TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
const authRoutes = new Map([
  ["/api/auth/get-session", "GET"],
  ["/api/auth/sign-out", "POST"],
  ["/api/auth/email-otp/send-verification-otp", "POST"],
  ["/api/auth/sign-in/email-otp", "POST"],
]);
export async function handleAccountApi(
  request: Request,
  env: AccountEnv,
  auth = accountsConfigured(env) ? createAuth(env) : null,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/account/status" && request.method === "GET")
    return json({ available: accountsConfigured(env) });
  if (!accountsConfigured(env) || !auth)
    return json(
      {
        error:
          "Accounts are not available yet. Your local training is unaffected.",
      },
      503,
    );
  if (url.origin !== env.AUTH_ORIGIN)
    return json({ error: "Account origin mismatch." }, 403);
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== env.AUTH_ORIGIN
  )
    return json({ error: "Open SettledSolo directly to continue." }, 403);
  if (env.ACCOUNT_RATE_LIMITER) {
    const limited = await env.ACCOUNT_RATE_LIMITER.limit({
      key: `${url.pathname}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`,
    });
    if (!limited.success)
      return json({ error: "Too many requests. Try again in a minute." }, 429);
  }
  try {
    if (url.pathname.startsWith("/api/auth/")) {
      if (authRoutes.get(url.pathname) !== request.method)
        return json({ error: "Not found" }, 404);
      let forwarded = request;
      if (request.method === "POST") {
        const body = await readJson(request);
        if (
          url.pathname.endsWith("send-verification-otp") &&
          (body as { type?: unknown })?.type !== "sign-in"
        )
          return json({ error: "Unsupported code request." }, 400);
        if (url.pathname.endsWith("send-verification-otp")) {
          const email = (body as { email?: unknown })?.email;
          if (typeof email !== "string" || email.length > 320)
            return json({ error: "Enter a valid email address." }, 400);
          if (env.OTP_RATE_LIMITER) {
            const limited = await env.OTP_RATE_LIMITER.limit({
              key: await otpRateLimitKey(email, env.BETTER_AUTH_SECRET!),
            });
            if (!limited.success)
              return json(
                {
                  error:
                    "A code was requested recently. Wait a minute before trying again.",
                },
                429,
              );
          }
        }
        forwarded = new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(body),
        });
      }
      const response = await auth.handler(forwarded);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, private");
      headers.set("Vary", "Cookie");
      return new Response(response.body, { status: response.status, headers });
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return json(
        {
          error: "Sign in again to sync. Your progress remains on this device.",
        },
        401,
      );
    if (url.pathname === "/api/sync" && request.method === "POST") {
      const input = await readJson(request);
      if (!input || typeof input !== "object" || Array.isArray(input))
        return json({ error: "Invalid sync request." }, 400);
      const { accountId, ...payload } = input as Record<string, unknown>;
      if (accountId !== session.user.id)
        return json(
          {
            error:
              "Your signed-in account changed. Sign in again before syncing this log.",
          },
          409,
        );
      return json(await sync(env.ACCOUNTS_DB!, session.user.id, payload));
    }
    if (url.pathname === "/api/account/export" && request.method === "GET") {
      const { results } = await env
        .ACCOUNTS_DB!.prepare(
          "SELECT record_key,revision,value_json FROM sync_records WHERE user_id=?",
        )
        .bind(session.user.id)
        .all();
      const history = await env
        .ACCOUNTS_DB!.prepare(
          "SELECT seq,mutation_id,record_key,value_json FROM sync_changes WHERE user_id=? ORDER BY seq",
        )
        .bind(session.user.id)
        .all();
      return json({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          createdAt: session.user.createdAt,
          updatedAt: session.user.updatedAt,
          emailVerified: session.user.emailVerified,
        },
        records: results,
        changeHistory: history.results,
      });
    }
    if (url.pathname === "/api/account/delete" && request.method === "POST") {
      const body = (await readJson(request)) as {
        confirmation?: string;
        accountId?: string;
      };
      if (body?.accountId !== session.user.id)
        return json(
          {
            error:
              "Your signed-in account changed. Refresh and review the account before deleting it.",
          },
          409,
        );
      if (body?.confirmation !== "DELETE")
        return json({ error: "Type DELETE to confirm." }, 400);
      if (Date.now() - new Date(session.session.createdAt).getTime() > 600_000)
        return json(
          {
            error:
              "Sign out and sign in with a fresh email code before deleting your account.",
          },
          403,
        );
      return await auth.api.deleteUser({
        headers: request.headers,
        body: {},
        asResponse: true,
      });
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error &&
        ["JSON_REQUIRED", "Invalid record key"].includes(error.message))
    )
      return json(
        {
          error: "The request could not be read. Update the app and try again.",
        },
        400,
      );
    if (error instanceof Error && error.message === "TOO_LARGE")
      return json(
        {
          error:
            "The upload is too large. Export a backup and contact support.",
        },
        413,
      );
    // Do not log requests, OTPs or private training content.
    return json(
      {
        error:
          "Account service unavailable. Keep training locally and try again later.",
      },
      503,
    );
  }
}
