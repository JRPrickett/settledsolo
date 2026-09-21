import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../domain/types";
import type { SyncedRepository } from "../data/repository";
import type { SyncReply } from "./protocol";
import { accountRequest, AccountError, type AccountUser } from "./client";
export function useAccount(
  repository: SyncedRepository,
  onData: (data: AppData) => void,
  paused: boolean,
) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const currentUser = useRef(user);
  currentUser.current = user;
  const epoch = useRef(0);
  const retryAt = useRef(0);
  const failures = useRef(0);
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const status = await accountRequest<{ available: boolean }>(
      "/api/account/status",
    );
    if (sequence !== refreshSequence.current) return currentUser.current;
    setAvailable(status.available);
    if (!status.available) return null;
    const session = await accountRequest<{ user: AccountUser } | null>(
      "/api/auth/get-session",
    );
    if (sequence !== refreshSequence.current) return currentUser.current;
    currentUser.current = session?.user ?? null;
    setUser(session?.user ?? null);
    return session?.user ?? null;
  }, []);
  const syncNow = useCallback(
    async (manual = false) => {
      const account = currentUser.current;
      if (
        running.current ||
        pausedRef.current ||
        !account ||
        (!manual && Date.now() < retryAt.current)
      )
        return;
      running.current = true;
      setSyncing(true);
      const generation = epoch.current;
      try {
        // Bound a foreground cycle; any remaining pages/outbox entries continue on the next tick.
        for (let page = 0; page < 20; page++) {
          if (pausedRef.current || generation !== epoch.current) break;
          const data = await repository.loadAppData();
          if (!data.sync?.enabled || data.sync.accountId !== account.id) break;
          if (repository.storageMode() !== "indexeddb")
            throw new Error(
              "Sync is paused while compatibility storage is in use. Keep a backup from More.",
            );
          const operations = data.sync.outbox.slice(0, 25);
          const reply = await accountRequest<SyncReply>("/api/sync", {
            accountId: account.id,
            cursor: data.sync.cursor,
            operations,
          });
          if (
            pausedRef.current ||
            generation !== epoch.current ||
            currentUser.current?.id !== account.id
          )
            break;
          const next = await repository.receiveSync(
            account.id,
            operations,
            reply,
            () => !pausedRef.current && generation === epoch.current,
          );
          onData(next);
          if (!reply.hasMore && !next.sync?.outbox.length) break;
        }
        failures.current = 0;
        retryAt.current = 0;
        setError("");
      } catch (failure) {
        if (failure instanceof AccountError && failure.status === 401) {
          currentUser.current = null;
          setUser(null);
        }
        if (failure instanceof AccountError && failure.status === 409) {
          await refresh().catch(() => {});
        }
        failures.current++;
        retryAt.current =
          Date.now() + Math.min(300_000, 5000 * 2 ** failures.current);
        setError(
          failure instanceof Error
            ? failure.message
            : "Sync paused. Try again later.",
        );
      } finally {
        running.current = false;
        setSyncing(false);
      }
    },
    [repository, onData, refresh],
  );
  useEffect(() => {
    let mounted = true;
    void refresh()
      .catch(() => {
        if (mounted) setAvailable(null);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      epoch.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (!ready) return;
    const check = async () => {
      if (document.visibilityState !== "visible" || pausedRef.current) return;
      if (!currentUser.current) {
        try {
          await refresh();
        } catch {
          return;
        }
      }
      await syncNow();
    };
    const timer = setInterval(check, 30_000);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [syncNow, user, paused, refresh, ready]);
  return {
    available,
    user,
    ready,
    error,
    syncing,
    refresh,
    syncNow,
    pauseForTraining() {
      epoch.current++;
      pausedRef.current = true;
    },
    async connect() {
      if (!currentUser.current) return;
      onData(await repository.connectAccount(currentUser.current.id));
      await syncNow(true);
    },
    async signOut() {
      epoch.current++;
      // Pause locally even if the network is down. Retain ownership to prevent a different account importing this log.
      onData(await repository.pauseSync());
      await accountRequest("/api/auth/sign-out", {});
      currentUser.current = null;
      setUser(null);
      setError("");
    },
    async deleted() {
      epoch.current++;
      onData(await repository.markAccountDeleted());
      currentUser.current = null;
      setUser(null);
      setError("");
    },
    async resolve(key: string, choice: "local" | "cloud") {
      onData(await repository.resolveConflict(key, choice));
      await syncNow(true);
    },
  };
}
export type AccountController = ReturnType<typeof useAccount>;
