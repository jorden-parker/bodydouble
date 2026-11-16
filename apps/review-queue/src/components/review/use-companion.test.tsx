import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCompanion } from "./use-companion";

function stubNarrow(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches, addEventListener() {}, removeEventListener() {} })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCompanion", () => {
  it("shows both regions and keeps them side by side on wide screens", () => {
    stubNarrow(false);
    const { result } = renderHook(() => useCompanion());
    act(() => result.current.setSideOpen("left", true));
    expect(result.current.regionOpen).toEqual({ left: true, right: true });
  });

  it("starts with both overlays closed on narrow screens and opens one at a time", () => {
    stubNarrow(true);
    const { result } = renderHook(() => useCompanion());
    expect(result.current.regionOpen).toEqual({ left: false, right: false });
    act(() => result.current.toggleSide("left"));
    expect(result.current.regionOpen).toEqual({ left: true, right: false });
    act(() => result.current.toggleSide("right"));
    expect(result.current.regionOpen).toEqual({ left: false, right: true });
  });

  it("opens the companion on the Context view when a context view is asked for", () => {
    stubNarrow(false);
    const { result } = renderHook(() => useCompanion());
    act(() => result.current.toggleSide("right"));
    act(() => result.current.showContextView("map"));
    expect(result.current).toMatchObject({ tab: "context", contextView: "map" });
    expect(result.current.regionOpen.right).toBe(true);
  });
});
