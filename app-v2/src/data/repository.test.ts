import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData, TrainingSession } from "../domain/types";
import type { SyncState } from "../account/syncState";
import { createAppRepository } from "./repository";

const FALLBACK_APP_KEY = "dog-training-app.fallback.v1";

function session(id: string, at: number, note = ""): TrainingSession {
  return {
    id,
    at,
    targetSeconds: 10,
    actualSeconds: 10,
    outcome: "relaxed",
    stoppedEarly: false,
    signals: [],
    tags: [],
    stopReason: "",
    note
  };
}

function storageHarness(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  let failWrites = false;

  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      if (failWrites) throw new Error("storage unavailable");
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      if (failWrites) throw new Error("storage unavailable");
      values.delete(key);
    },
    setItem(key, value) {
      if (failWrites) throw new Error("storage unavailable");
      values.set(key, value);
    }
  };

  return {
    storage,
    failWrites() {
      failWrites = true;
    }
  };
}

function memoryOnly(storage?: Storage) {
  vi.stubGlobal("indexedDB", undefined);
  vi.stubGlobal("localStorage", storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("repository hardening", () => {
  it("reports checkpoint-only storage failures and unsubscribes cleanly", async () => {
    const harness = storageHarness();
    memoryOnly(harness.storage);
    const repository = createAppRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribeStorageMode(listener);
    expect(listener).toHaveBeenLastCalledWith("localstorage");
    harness.failWrites();
    await repository.clearActiveSession();
    expect(listener).toHaveBeenLastCalledWith("memory");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await repository.saveSetup("Mabel", 5, "known-duration");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("serializes rapid local mutations so later operations do not overwrite earlier ones", async () => {
    memoryOnly();
    const repository = createAppRepository();
    await repository.saveSetup("Mabel", 5, "known-duration");

    await Promise.all([
      repository.appendSession(session("one", 1), "training"),
      repository.appendSession(session("two", 2), "training"),
      repository.appendSession(session("three", 3), "training")
    ]);

    await Promise.all([
      repository.updateSession("training", session("one", 1, "edited")),
      repository.updateDailyCap(3),
      repository.appendSession(session("four", 4), "training")
    ]);

    const data = await repository.loadAppData();
    expect(data.scenarios[0].sessions.map((item) => item.id)).toEqual([
      "one",
      "two",
      "three",
      "four"
    ]);
    expect(data.scenarios[0].sessions[0].note).toBe("edited");
    expect(data.dailyCap).toBe(3);
  });

  it("keeps a rapid update-then-delete deleted instead of resurrecting the session", async () => {
    memoryOnly();
    const repository = createAppRepository();
    await repository.saveSetup("Mabel", 5, "known-duration");
    await repository.appendSession(session("one", 1), "training");

    await Promise.all([
      repository.updateSession("training", session("one", 1, "newer edit")),
      repository.deleteSession("training", "one")
    ]);

    expect((await repository.loadAppData()).scenarios[0].sessions).toEqual([]);
  });

  it("degrades to in-memory storage without losing the current session data when localStorage starts failing", async () => {
    const harness = storageHarness();
    memoryOnly(harness.storage);
    const repository = createAppRepository();

    expect(repository.storageMode()).toBe("localstorage");
    harness.failWrites();

    await repository.saveSetup("Mabel", 8, "known-duration");
    await repository.appendSession(session("saved-in-memory", 1), "training");

    const data = await repository.loadAppData();
    expect(repository.storageMode()).toBe("memory");
    expect(data.dogName).toBe("Mabel");
    expect(data.scenarios[0].sessions.map((item) => item.id)).toEqual([
      "saved-in-memory"
    ]);
  });

  it("falls back safely when the persisted local snapshot is corrupted", async () => {
    const harness = storageHarness({
      [FALLBACK_APP_KEY]: "{ definitely not valid JSON"
    });
    memoryOnly(harness.storage);

    const repository = createAppRepository();
    const data = await repository.loadAppData();

    expect(repository.storageMode()).toBe("memory");
    expect(data).toMatchObject({
      dogName: "",
      activeScenarioId: "training",
      scenarios: [
        {
          id: "training",
          label: "Separation training",
          startSeconds: 5,
          sessions: []
        }
      ]
    });
  });

  it("never accepts account ownership or sync state from restored app data", async () => {
    memoryOnly();
    const repository = createAppRepository();
    await repository.saveSetup("Mabel", 5, "known-duration");
    const connected = await repository.connectAccount("owner-account");

    const foreignSync: SyncState = {
      accountId: "foreign-account",
      enabled: true,
      cursor: 999,
      shadow: {},
      remote: {},
      outbox: [],
      conflicts: [],
      archive: []
    };
    const restored: AppData = {
      ...connected,
      dogName: "Ruby",
      sync: foreignSync
    };

    await repository.saveAppData(restored);
    const after = await repository.loadAppData();

    expect(after.dogName).toBe("Ruby");
    expect(after.sync?.accountId).toBe("owner-account");
    expect(after.sync?.accountId).not.toBe("foreign-account");
  });

  it("keeps sign-out, cloud deletion and local reset as distinct operations", async () => {
    memoryOnly();
    const repository = createAppRepository();
    await repository.saveSetup("Mabel", 5, "known-duration");
    await repository.appendSession(session("kept", 1), "training");
    await repository.connectAccount("owner-account");

    const signedOut = await repository.pauseSync();
    expect(signedOut.dogName).toBe("Mabel");
    expect(signedOut.scenarios[0].sessions).toHaveLength(1);
    expect(signedOut.sync).toMatchObject({
      accountId: "owner-account",
      enabled: false
    });
    expect(signedOut.sync?.deleted).not.toBe(true);

    await repository.connectAccount("owner-account");
    const cloudDeleted = await repository.markAccountDeleted();
    expect(cloudDeleted.dogName).toBe("Mabel");
    expect(cloudDeleted.scenarios[0].sessions).toHaveLength(1);
    expect(cloudDeleted.sync).toMatchObject({
      accountId: "owner-account",
      enabled: false,
      deleted: true
    });

    const reset = await repository.resetAppData();
    expect(reset.dogName).toBe("");
    expect(reset.scenarios[0].sessions).toHaveLength(0);
    expect(reset.sync).toBeUndefined();
  });
});
