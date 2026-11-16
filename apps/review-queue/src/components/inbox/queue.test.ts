import { describe, expect, it } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import type { ProgressSummary } from "@/lib/session/store";
import { initialsOf, layoutQueue, rankQueue, sizeOf, type QueueEntry } from "./queue";

const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function request(number: number): ReviewRequest {
  return {
    ref: { owner: "acme", repo: "app", number },
    title: `PR ${number}`,
    url: `https://github.com/acme/app/pull/${number}`,
    author: "sam",
    updatedAt: new Date(NOW).toISOString(),
  };
}

function facts(overrides: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    additions: 100,
    deletions: 10,
    changedFiles: 4,
    headSha: "head1",
    reviewDecision: null,
    checks: "passing",
    createdAt: new Date(NOW - DAY).toISOString(),
    isClosed: false,
    ...overrides,
  };
}

function progress(overrides: Partial<ProgressSummary> = {}): ProgressSummary {
  return {
    doneCount: 2,
    noteCount: 0,
    lastHeadSha: "head1",
    updatedAt: new Date(NOW - HOUR).toISOString(),
    pause: null,
    totalSteps: 9,
    ...overrides,
  };
}

function entry(number: number, overrides: Partial<QueueEntry> = {}): QueueEntry {
  return { request: request(number), facts: facts(), progress: null, ...overrides };
}

const numbers = (entries: QueueEntry[]) => entries.map((item) => item.request.ref.number);

describe("initialsOf", () => {
  it("takes the first letters of the first two words of a login", () => {
    expect(initialsOf("mira-k")).toBe("MK");
    expect(initialsOf("sam")).toBe("SA");
  });
});

describe("sizeOf", () => {
  it("counts added and removed lines together and buckets them S, M or L", () => {
    expect(sizeOf(facts({ additions: 212, deletions: 48 }))).toBe("S");
    expect(sizeOf(facts({ additions: 200, deletions: 200 }))).toBe("M");
    expect(sizeOf(facts({ additions: 700, deletions: 200 }))).toBe("L");
  });
});

describe("rankQueue", () => {
  it("puts paused, then new commits, then started, then not started", () => {
    const entries = [
      entry(1),
      entry(2, { progress: progress() }),
      entry(3, {
        progress: progress({ pause: { note: "tests", at: "2026-11-16T10:00:00.000Z" } }),
      }),
      entry(4, { progress: progress({ lastHeadSha: "old" }) }),
    ];
    expect(numbers(rankQueue(entries))).toEqual([3, 4, 2, 1]);
  });

  it("orders each group by checks passing first, then smaller, then older", () => {
    const entries = [
      entry(1, { facts: facts({ checks: "failing", additions: 1, deletions: 0 }) }),
      entry(2, { facts: facts({ additions: 900, deletions: 0 }) }),
      entry(3, { facts: facts({ additions: 50, deletions: 0 }) }),
      entry(4, {
        facts: facts({
          additions: 50,
          deletions: 0,
          createdAt: new Date(NOW - 5 * DAY).toISOString(),
        }),
      }),
    ];
    expect(numbers(rankQueue(entries))).toEqual([4, 3, 2, 1]);
  });
});

describe("layoutQueue", () => {
  it("picks the first ranked PR as Up next with a reason and lists each PR once", () => {
    const entries = [entry(1), entry(2, { progress: progress() })];
    const layout = layoutQueue(entries, {}, NOW);
    expect(layout.upNext?.entry.request.ref.number).toBe(2);
    expect(layout.upNext?.reason).toBe("Picked because you already started it.");
    expect(layout.continued).toEqual([]);
    expect(layout.waiting.map((item) => item.request.ref.number)).toEqual([1]);
  });

  it("gives a not-started PR a reason built from its size, checks and age", () => {
    const layout = layoutQueue(
      [entry(1, { facts: facts({ additions: 400, deletions: 12 }) })],
      {},
      NOW,
    );
    expect(layout.upNext?.reason).toBe(
      "Picked because it is medium, checks pass, and it has waited 24\u00a0h.",
    );
  });

  it("sorts the rest into Continue, New commits and Waiting", () => {
    const entries = [
      entry(1, { progress: progress({ pause: { note: "x", at: "2026-11-16T10:00:00.000Z" } }) }),
      entry(2, { progress: progress({ lastHeadSha: "old" }) }),
      entry(3, { progress: progress() }),
      entry(4),
    ];
    const layout = layoutQueue(entries, {}, NOW);
    expect(layout.upNext?.entry.request.ref.number).toBe(1);
    expect(numbers(layout.continued)).toEqual([3]);
    expect(numbers(layout.newCommits)).toEqual([2]);
    expect(numbers(layout.waiting)).toEqual([4]);
  });

  it("moves a snoozed PR to Later until its time passes", () => {
    const entries = [entry(1), entry(2)];
    const snoozes = { "acme/app#1": { at: new Date(NOW + HOUR).toISOString() } };
    const layout = layoutQueue(entries, snoozes, NOW);
    expect(numbers(layout.later)).toEqual([1]);
    expect(layout.upNext?.entry.request.ref.number).toBe(2);
    const expired = layoutQueue(entries, { "acme/app#1": { at: "2026-11-16T11:00:00.000Z" } }, NOW);
    expect(expired.later).toEqual([]);
    expect(expired.upNext?.entry.request.ref.number).toBe(1);
  });

  it("returns a snoozed PR when its head moves", () => {
    const entries = [entry(1, { facts: facts({ headSha: "head2" }) })];
    const snoozes = { "acme/app#1": { headSha: "head1" } };
    expect(layoutQueue(entries, snoozes, NOW).later).toEqual([]);
    expect(layoutQueue(entries, snoozes, NOW).upNext?.entry.request.ref.number).toBe(1);
  });

  it("has no Up next when nothing is waiting", () => {
    expect(layoutQueue([], {}, NOW).upNext).toBeNull();
  });
});
