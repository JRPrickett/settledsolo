import { describe, expect, it } from "vitest";
import { connect, reconcile, applyReply, resolveConflict } from "./syncState";
import { flatten, valueSchema, type SyncReply } from "./protocol";
import type { AppData, TrainingSession } from "../domain/types";
import { OBSERVED_SIGNAL_VALUES } from "../domain/observedSignals";
const session = (id: string, note = ""): TrainingSession => ({
  id,
  at: 100,
  targetSeconds: 5,
  actualSeconds: 5,
  outcome: "relaxed",
  stoppedEarly: false,
  signals: [],
  tags: [],
  stopReason: "",
  note,
});
describe("sync accepts every observed signal", () => {
  it("does not reject a session carrying all of them", () => {
    const parsed = valueSchema.safeParse({
      kind: "session",
      scenarioId: "training",
      ...session("all-signals"),
      signals: OBSERVED_SIGNAL_VALUES,
    });

    expect(parsed.success).toBe(true);
  });

  it("still rejects a signal it does not know", () => {
    const parsed = valueSchema.safeParse({
      kind: "session",
      scenarioId: "training",
      ...session("bad-signal"),
      signals: ["not-a-signal"],
    });

    expect(parsed.success).toBe(false);
  });
});

const guest = (): AppData => ({
  dogName: "Mabel",
  activeScenarioId: "training",
  scenarios: [
    {
      id: "training",
      label: "Home",
      startSeconds: 5,
      sessions: [session("first")],
    },
  ],
});
const ack = (data: AppData): AppData => {
  const sent = data.sync!.outbox;
  return applyReply(data, "a", sent, {
    accepted: sent.map((op, i) => ({ id: op.id, revision: i + 1 })),
    conflicts: [],
    changes: sent.map((op, i) => ({
      key: op.key,
      value: op.value,
      revision: i + 1,
    })),
    cursor: sent.length,
    hasMore: false,
  });
};
const reply = (
  key: string,
  value: ReturnType<typeof flatten>[string] | null,
  revision = 20,
): SyncReply => ({
  accepted: [],
  conflicts: [],
  changes: [{ key, value, revision }],
  cursor: revision,
  hasMore: false,
});
describe("private local-first sync", () => {
  it("keeps guest data unconnected until explicit consent, then preserves all IDs", () => {
    const data = guest();
    expect(reconcile(data).sync).toBeUndefined();
    const linked = connect(data, "a");
    expect(linked.sync!.outbox).toHaveLength(3);
    expect(ack(linked).scenarios).toEqual(data.scenarios);
    expect(ack(linked).sync!.outbox).toHaveLength(0);
  });
  it("merges another device's new session while retaining this device's offline session", () => {
    let data = ack(connect(guest(), "a"));
    data.scenarios[0].sessions.push(session("offline"));
    data = reconcile(data);
    data = applyReply(
      data,
      "a",
      [],
      reply("session:training:remote", {
        ...session("remote"),
        kind: "session",
        scenarioId: "training",
      }),
    );
    expect(data.scenarios[0].sessions.map((s) => s.id).sort()).toEqual([
      "first",
      "offline",
      "remote",
    ]);
    expect(data.sync!.outbox).toHaveLength(1);
  });
  it("does not acknowledge a newer local edit with an older in-flight response", () => {
    let data = ack(connect(guest(), "a"));
    data.scenarios[0].sessions[0].note = "sent";
    data = reconcile(data);
    const sent = structuredClone(data.sync!.outbox);
    data.scenarios[0].sessions[0].note = "newer";
    data = reconcile(data);
    data = applyReply(data, "a", sent, {
      accepted: [{ id: sent[0].id, revision: 10 }],
      conflicts: [],
      changes: [],
      cursor: 10,
      hasMore: false,
    });
    expect(data.scenarios[0].sessions[0].note).toBe("newer");
    expect(data.sync!.outbox[0].base).toBe(10);
    expect(data.sync!.outbox[0].id).not.toBe(sent[0].id);
  });
  it("keeps both conflicting edits and archives the unselected version", () => {
    let data = ack(connect(guest(), "a"));
    data.scenarios[0].sessions[0].note = "local";
    data = reconcile(data);
    data = applyReply(
      data,
      "a",
      [],
      reply("session:training:first", {
        ...session("first", "cloud"),
        kind: "session",
        scenarioId: "training",
      }),
    );
    expect(data.scenarios[0].sessions[0].note).toBe("local");
    expect(data.sync!.conflicts).toHaveLength(1);
    data = resolveConflict(data, "session:training:first", "cloud");
    expect(data.scenarios[0].sessions[0].note).toBe("cloud");
    expect(data.sync!.archive[0].local).toMatchObject({ note: "local" });
  });
  it("propagates tombstones, with delete/edit conflicts kept for review", () => {
    let data = ack(connect(guest(), "a"));
    const removed = applyReply(
      data,
      "a",
      [],
      reply("session:training:first", null),
    );
    expect(removed.scenarios[0].sessions).toHaveLength(0);
    data.scenarios[0].sessions[0].note = "offline edit";
    data = reconcile(data);
    const conflicted = applyReply(
      data,
      "a",
      [],
      reply("session:training:first", null),
    );
    expect(conflicted.sync!.conflicts[0].remote.value).toBeNull();
    expect(conflicted.scenarios[0].sessions).toHaveLength(1);
  });
  it("keeps pending work bound to its owner after sign-out and rejects account switching", () => {
    let data = connect(guest(), "a");
    data.sync!.enabled = false;
    expect(() => connect(data, "b")).toThrow("another account");
    expect(applyReply(data, "a", [], reply("profile:primary", null))).toEqual(
      data,
    );
    expect(connect(data, "a").sync!.outbox).toHaveLength(3);
  });
  it("reconstructs a fresh device across incremental pages without uploading downloads", () => {
    let data = connect(
      { dogName: "", activeScenarioId: "training", scenarios: [] },
      "a",
    );
    for (const [key, value] of Object.entries(flatten(guest())))
      data = applyReply(data, "a", [], reply(key, value));
    expect(data.dogName).toBe("Mabel");
    expect(data.scenarios[0].sessions[0].id).toBe("first");
    expect(reconcile(data).sync!.outbox).toHaveLength(0);
  });
  it("does not hide local history when another device deletes its parent track", () => {
    let data = ack(connect(guest(), "a"));
    data = applyReply(data, "a", [], reply("scenario:training", null));
    expect(data.sync!.conflicts).toHaveLength(1);
    expect(data.scenarios[0].sessions).toHaveLength(1);
    expect(() => resolveConflict(data, "scenario:training", "cloud")).toThrow(
      "last training track",
    );
    const keep = resolveConflict(data, "scenario:training", "local");
    expect(keep.sync!.outbox[0].base).toBe(20);
  });
  it("can explicitly reconnect a retained log after its former cloud account was deleted", () => {
    const data = ack(connect(guest(), "a"));
    data.sync!.enabled = false;
    data.sync!.deleted = true;
    const next = connect(data, "new-account");
    expect(next.sync!.accountId).toBe("new-account");
    expect(next.sync!.outbox).toHaveLength(3);
    expect(next.sync!.outbox.every((op) => op.base === 0)).toBe(true);
  });
});
