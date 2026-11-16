import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_MS, IdlePreparation } from "./idle-preparation";

const KEY = "acme/app#7";

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
}

beforeEach(() => setVisibility("visible"));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "visibilityState");
});

describe("IdlePreparation", () => {
  it("asks the server once to prepare the PR after the page has been idle", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => Response.json({ status: "prepared" }));
    vi.stubGlobal("fetch", fetchImpl);
    render(<IdlePreparation pullRequestKey={KEY} />);
    await vi.advanceTimersByTimeAsync(IDLE_MS - 1);
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/prepare");
    expect(JSON.parse(String(init.body))).toEqual({ key: KEY });
  });

  it("stops the request the moment the reader presses a key", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise<Response>(() => undefined);
      }),
    );
    render(<IdlePreparation pullRequestKey={KEY} />);
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    expect(signals).toHaveLength(1);
    fireEvent.keyDown(window, { key: "j" });
    expect(signals[0].aborted).toBe(true);
  });

  it("never asks while the tab is hidden", async () => {
    vi.useFakeTimers();
    setVisibility("hidden");
    const fetchImpl = vi.fn(async () => Response.json({ status: "prepared" }));
    vi.stubGlobal("fetch", fetchImpl);
    render(<IdlePreparation pullRequestKey={KEY} />);
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
