import { describe, expect, it, vi } from "vitest";
import { claimAppWindow, type WindowLocks } from "./windowOwnership";

describe("app window ownership", () => {
  it("holds ownership until disposal, without stealing or a suspension timeout", async () => {
    let holding: Promise<void> | undefined;
    const request = vi.fn<WindowLocks["request"]>((_name, _options, callback) => {
      holding = Promise.resolve(callback({ name: "settledsolo-app-window", mode: "exclusive" }));
      return holding;
    });
    const state = vi.fn();
    const dispose = claimAppWindow({ request }, state);
    expect(state.mock.calls.map(call => call[0])).toEqual(["checking", "active"]);
    expect(request.mock.calls[0][1]).toEqual({ mode: "exclusive", ifAvailable: true });
    const released = vi.fn();
    void holding!.then(released);
    await Promise.resolve();
    expect(released).not.toHaveBeenCalled();
    dispose();
    await holding;
    expect(released).toHaveBeenCalledOnce();
  });

  it("keeps a competing window waiting", async () => {
    const request = vi.fn<WindowLocks["request"]>(async (_name, _options, callback) => callback(null));
    const state = vi.fn();
    claimAppWindow({ request }, state);
    expect(state.mock.calls.map(call => call[0])).toEqual(["checking", "waiting"]);
  });

  it("does not activate an abandoned request, including Strict Mode cleanup", async () => {
    let grant: (lock: Lock | null) => unknown = () => {};
    const request = vi.fn<WindowLocks["request"]>(async (_name, _options, callback) => { grant = callback; });
    const state = vi.fn();
    const dispose = claimAppWindow({ request }, state);
    dispose();
    expect(grant({ name: "settledsolo-app-window", mode: "exclusive" })).toBeUndefined();
    expect(state).toHaveBeenCalledExactlyOnceWith("checking");
  });

  it("requires an explicit compatibility choice when locking is unavailable or denied", async () => {
    const state = vi.fn();
    claimAppWindow(undefined, state);
    expect(state).toHaveBeenLastCalledWith("unavailable");
    state.mockClear();
    claimAppWindow({ request: vi.fn().mockRejectedValue(new Error("denied")) }, state);
    await Promise.resolve();
    expect(state).toHaveBeenLastCalledWith("unavailable");
  });
});
