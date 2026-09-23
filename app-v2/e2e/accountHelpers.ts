import { expect, type Page, type BrowserContext } from "@playwright/test";
import type { RemoteRecord, SyncOperation } from "../src/account/protocol";
/** An in-memory account/sync server shared by every context attached to it. */
export function cloud() {
  const records = new Map<string, RemoteRecord>();
  const changes: RemoteRecord[] = [];
  const receipts = new Map<string, number>();
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    renameDog(name: string) {
      const value = {
        kind: "profile" as const,
        dogId: "primary",
        dogName: name,
      };
      const record = {
        key: "profile:primary",
        revision: changes.length + 1,
        value,
      };
      records.set(record.key, record);
      changes.push(record);
    },
    async attach(context: BrowserContext) {
      const state = {
        signedIn: false,
        online: true,
        account: "owner",
        hold: null as Promise<void> | null,
        sessionHold: null as Promise<void> | null,
      };
      await context.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (!state.online) {
          await route.abort();
          return;
        }
        const respond = (json: unknown, status = 200) =>
          route.fulfill({ status, json });
        if (path === "/api/account/status") return respond({ available: true });
        if (path === "/api/auth/get-session") {
          if (state.sessionHold) await state.sessionHold;
          return respond(
            state.signedIn
              ? {
                  user: {
                    id: state.account,
                    email: `${state.account}@example.test`,
                  },
                }
              : null,
          );
        }
        if (path.endsWith("send-verification-otp"))
          return respond({ success: true });
        if (path.endsWith("sign-in/email-otp")) {
          state.signedIn = true;
          return respond({ success: true });
        }
        if (path.endsWith("sign-out")) {
          state.signedIn = false;
          return respond({ success: true });
        }
        if (path === "/api/sync") {
          requests++;
          if (state.hold) {
            const hold = state.hold;
            state.hold = null;
            await hold;
          }
          if (!state.signedIn) return respond({ error: "Sign in again" }, 401);
          const body = route.request().postDataJSON() as {
            cursor: number;
            operations: SyncOperation[];
          };
          const accepted: { id: string; revision: number }[] = [];
          const conflicts: { id: string; record: RemoteRecord }[] = [];
          for (const operation of body.operations) {
            const existing = records.get(operation.key);
            const receipt = receipts.get(operation.id);
            if (receipt) accepted.push({ id: operation.id, revision: receipt });
            else if ((existing?.revision ?? 0) !== operation.base)
              conflicts.push({ id: operation.id, record: existing! });
            else {
              const record = {
                key: operation.key,
                revision: changes.length + 1,
                value: operation.value,
              };
              records.set(record.key, record);
              changes.push(record);
              receipts.set(operation.id, record.revision);
              accepted.push({ id: operation.id, revision: record.revision });
            }
          }
          return respond({
            accepted,
            conflicts,
            changes: changes.filter((item) => item.revision > body.cursor),
            cursor: changes.length,
            hasMore: false,
          });
        }
        return respond({ error: "Not found" }, 404);
      });
      return state;
    },
  };
}
export async function setup(page: Page) {
  await page.goto("/app/");
  await page.getByLabel("Your dog's name").fill("Mabel");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /^Stays relaxed/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: /^Yes/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Comfortable duration").fill("1");
  await page.getByRole("button", { name: "See my starting plan" }).click();
  await page.getByRole("button", { name: "Use this starting plan" }).click();
  await expect(
    page.getByRole("button", { name: "Start today's session" }),
  ).toBeVisible();
}
export async function signIn(page: Page) {
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText(/Check your junk or spam folder/)).toBeVisible();
  await page.getByLabel("Sign-in code").fill("123456");
  await page
    .getByRole("button", { name: "Sign in or create account", exact: true })
    .click();
  await expect(page.getByText("Signed in as", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Passwordless email account · signed in on this device"),
  ).toBeVisible();
}
