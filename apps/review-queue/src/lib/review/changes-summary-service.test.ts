import { describe, expect, it, vi } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { addedHunk, fileDiff, lines } from "@/test/diff-builders";
import { modelReply } from "@/test/fake-llm";
import { changesSummaryFor } from "./changes-summary-service";
import type { PreparedReview, ReviewData } from "./prepare";

const REVIEW_DATA: ReviewData = {
  pr: { ref: { owner: "a", repo: "b", number: 1 }, title: "T", body: "" } as PullRequest,
  headSha: "head",
  files: [],
  steps: [],
  startStepId: null,
  hotspots: [],
  estimateMinutes: 1,
  changeMap: { nodes: [], edges: [], threads: [], orphanIds: [] },
};
const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  backend: "local" as const,
  thinking: true,
  timeoutMs: 1000,
};

function reviewWithChanges(hunkLines: string[]): PreparedReview {
  const diffFrom = vi.fn(async () => [fileDiff("src/a.ts", [addedHunk(hunkLines)])]);
  return { data: REVIEW_DATA, diffFrom } as unknown as PreparedReview;
}

function countingFetch() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return modelReply("The new commits add a retry.");
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

describe("changesSummaryFor", () => {
  it("summarises a small change once and serves it again for the same baseline and head", async () => {
    const store = new SessionStore(":memory:");
    const review = reviewWithChanges(["retry()"]);
    const { fetchImpl, calls } = countingFetch();
    const first = await changesSummaryFor(review, "base", store, CONFIG, fetchImpl);
    const second = await changesSummaryFor(review, "base", store, CONFIG, fetchImpl);
    expect(first).toEqual({
      status: "ready",
      summary: { summary: "The new commits add a retry.", model: "m" },
    });
    expect(second).toEqual(first);
    expect(calls()).toBe(1);
  });

  it("asks again for a different baseline", async () => {
    const store = new SessionStore(":memory:");
    const review = reviewWithChanges(["retry()"]);
    const { fetchImpl, calls } = countingFetch();
    await changesSummaryFor(review, "base", store, CONFIG, fetchImpl);
    await changesSummaryFor(review, "other", store, CONFIG, fetchImpl);
    expect(calls()).toBe(2);
  });

  it("skips the model when the change is too large to read quickly", async () => {
    const store = new SessionStore(":memory:");
    const review = reviewWithChanges(lines(1000, "const value = computeTheThing(input);"));
    const { fetchImpl, calls } = countingFetch();
    expect(await changesSummaryFor(review, "base", store, CONFIG, fetchImpl)).toEqual({
      status: "skipped",
    });
    expect(calls()).toBe(0);
  });

  it("is disabled when the LLM is switched off", async () => {
    const store = new SessionStore(":memory:");
    const review = reviewWithChanges(["retry()"]);
    expect(await changesSummaryFor(review, "base", store, { ...CONFIG, enabled: false })).toEqual({
      status: "disabled",
    });
  });
});
