import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchModelStatus } from "@/components/review/api";
import { useModelStatus } from "./use-model-status";

vi.mock("@/components/review/api", () => ({ fetchModelStatus: vi.fn(async () => null) }));

function setHidden(isHidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => isHidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchModelStatus).mockClear();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useModelStatus", () => {
  it("asks for the model status once, then at most every 15 seconds", async () => {
    renderHook(() => useModelStatus());
    expect(fetchModelStatus).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(14_000));
    expect(fetchModelStatus).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(fetchModelStatus).toHaveBeenCalledTimes(2);
  });

  it("stops asking while the tab is hidden, and asks again as soon as it is shown", async () => {
    renderHook(() => useModelStatus());
    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchModelStatus).toHaveBeenCalledTimes(1);
    setHidden(false);
    expect(fetchModelStatus).toHaveBeenCalledTimes(2);
  });
});
