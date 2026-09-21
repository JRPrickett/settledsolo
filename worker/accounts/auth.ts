import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";

export interface AccountEnv {
  ACCOUNTS_DB?: D1Database;
  ACCOUNT_RATE_LIMITER?: RateLimit;
  OTP_RATE_LIMITER?: RateLimit;
  ACCOUNTS_ENABLED?: string;
  AUTH_ORIGIN?: string;
  BETTER_AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
}

export async function otpRateLimitKey(
  email: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(email.trim().toLowerCase()),
    ),
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
export function accountsConfigured(env: AccountEnv): boolean {
  return (
    env.ACCOUNTS_ENABLED === "true" &&
    Boolean(
      env.ACCOUNTS_DB &&
        env.AUTH_ORIGIN?.startsWith("https://") &&
        (env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 &&
        env.RESEND_API_KEY &&
        env.AUTH_EMAIL_FROM,
    )
  );
}

export function createAuth(
  env: AccountEnv,
  deliver = async (email: string, otp: string) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to: [email],
        subject: "Your SettledSolo sign-in code",
        text: `Your SettledSolo code is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery unavailable");
  },
) {
  return betterAuth({
    appName: "SettledSolo",
    database: env.ACCOUNTS_DB!,
    baseURL: env.AUTH_ORIGIN!,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET!,
    trustedOrigins: [env.AUTH_ORIGIN!],
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      freshAge: 600,
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await env
            .ACCOUNTS_DB!.prepare("DELETE FROM verification WHERE identifier=?")
            .bind(`sign-in-otp-${user.email}`)
            .run();
        },
      },
    },
    advanced: {
      useSecureCookies: true,
      cookiePrefix: "settledsolo",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
      },
    },
    logger: { disabled: true },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in")
            throw new Error("Unsupported verification type");
          await deliver(email, otp);
        },
      }),
    ],
  });
}
