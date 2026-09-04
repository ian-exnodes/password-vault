import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipboardExpiry, VaultLifecycle } from "@/lib/security/lifecycle";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("VaultLifecycle", () => {
  it("locks after inactivity and resets the deadline on activity", () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    const lifecycle = new VaultLifecycle(onLock, 100, 30);
    lifecycle.start();
    vi.advanceTimersByTime(80);
    lifecycle.activity();
    vi.advanceTimersByTime(80);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(onLock).toHaveBeenCalledWith("inactivity");
    lifecycle.stop();
  });

  it("locks after sustained backgrounding but cancels on foreground", () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    const lifecycle = new VaultLifecycle(onLock, 1_000, 30);
    lifecycle.start();
    lifecycle.background();
    vi.advanceTimersByTime(20);
    lifecycle.foreground();
    vi.advanceTimersByTime(20);
    expect(onLock).not.toHaveBeenCalled();
    lifecycle.background();
    vi.advanceTimersByTime(30);
    expect(onLock).toHaveBeenCalledWith("background");
    lifecycle.stop();
  });

  it("removes all pending timers when stopped", () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    const lifecycle = new VaultLifecycle(onLock, 100, 30);
    lifecycle.start();
    lifecycle.background();
    lifecycle.stop();
    vi.runAllTimers();
    expect(onLock).not.toHaveBeenCalled();
  });
});

describe("ClipboardExpiry", () => {
  it("clears the copied secret after the expiry when it is unchanged", async () => {
    vi.useFakeTimers();
    const clipboard = { readText: vi.fn().mockResolvedValue("secret"), writeText: vi.fn().mockResolvedValue(undefined) };
    const expiry = new ClipboardExpiry(clipboard, 30);
    expiry.schedule("secret");
    await vi.advanceTimersByTimeAsync(30);
    expect(clipboard.writeText).toHaveBeenCalledWith("");
  });

  it("does not erase newer clipboard content", async () => {
    vi.useFakeTimers();
    const clipboard = { readText: vi.fn().mockResolvedValue("newer value"), writeText: vi.fn().mockResolvedValue(undefined) };
    const expiry = new ClipboardExpiry(clipboard, 30);
    expiry.schedule("secret");
    await vi.advanceTimersByTimeAsync(30);
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("fails safely when clipboard read permission is denied", async () => {
    const clipboard = { readText: vi.fn().mockRejectedValue(new DOMException("Denied")), writeText: vi.fn() };
    await expect(new ClipboardExpiry(clipboard).clearIfUnchanged()).resolves.toBe(false);
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });
});
