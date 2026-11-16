import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeApi } from "@/test/fake-api";
import { describeSyncErrors, useSync } from "./use-sync";

describe("describeSyncErrors", () => {
  it("says when the cooldown reused the last result instead of fetching", () => {
    const [notice] = describeSyncErrors({ errors: {}, uncountedReviewRepos: [], isReused: true });

    expect(notice).toMatch(/synced moments ago/i);
  });

  it("stays quiet after a fresh sync", () => {
    expect(describeSyncErrors({ errors: {}, uncountedReviewRepos: [] })).toEqual([]);
  });
});

describe("useSync", () => {
  it("reports the described sync problems and counts the completed sync", async () => {
    const runSync = vi.fn(async () => ({
      errors: { shortcut: "token expired" },
      uncountedReviewRepos: [],
    }));
    const { result } = renderHook(() => useSync(fakeApi({ runSync }), describeSyncErrors));

    await act(() => result.current.sync());

    expect(result.current.problems).toEqual(["Shortcut: token expired"]);
    expect(result.current.completedSyncs).toBe(1);
    expect(result.current.syncing).toBe(false);
  });

  it("is syncing until the sync settles", async () => {
    let finishSync: () => void = () => {};
    const runSync = vi.fn(
      () =>
        new Promise<{ errors: Record<string, string>; uncountedReviewRepos: string[] }>(
          (resolve) => {
            finishSync = () => resolve({ errors: {}, uncountedReviewRepos: [] });
          },
        ),
    );
    const { result } = renderHook(() => useSync(fakeApi({ runSync }), describeSyncErrors));

    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.sync();
    });
    expect(result.current.syncing).toBe(true);

    await act(async () => {
      finishSync();
      await running;
    });
    expect(result.current.syncing).toBe(false);
  });

  it("reports a failed sync without counting it as completed", async () => {
    const runSync = vi.fn(async () => {
      throw new Error("Shortcut is unreachable");
    });
    const { result } = renderHook(() => useSync(fakeApi({ runSync }), describeSyncErrors));

    await act(() => result.current.sync());

    expect(result.current.problems).toEqual(["Shortcut is unreachable"]);
    expect(result.current.completedSyncs).toBe(0);
    expect(result.current.syncing).toBe(false);
  });
});
