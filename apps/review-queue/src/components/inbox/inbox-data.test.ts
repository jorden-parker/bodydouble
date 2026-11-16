import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { SessionStore } from "@/lib/session/store";
import { attachIntents, loadInbox } from "./inbox-data";
import { orientationFor } from "@/lib/review/orientation-service";
import type { ReviewData } from "@/lib/review/prepare";
import { modelReply } from "@/test/fake-llm";
import type { QueueEntry } from "./queue";

const fakes = vi.hoisted(() => ({
  store: null as unknown as import("@/lib/session/store").SessionStore,
  reviewRequests: null as unknown as () => Promise<unknown>,
  openPullRequests: null as unknown as (authorship: string) => Promise<unknown>,
  pullRequestFacts: null as unknown as (refs: unknown[]) => Promise<unknown>,
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/review/services", () => ({
  sessionStore: () => fakes.store,
  reviewRequests: () => fakes.reviewRequests(),
  openPullRequests: (authorship: string) => fakes.openPullRequests(authorship),
  pullRequestFacts: (refs: unknown[]) => fakes.pullRequestFacts(refs),
  currentLlmConfig: async () => ({ ...LLM_CONFIG, enabled: false }),
}));

const NOW = Date.parse("2026-11-16T12:00:00.000Z");

function request(repository: string, number: number, title = `PR ${number}`): ReviewRequest {
  const [owner, repo] = repository.split("/");
  return {
    ref: { owner, repo, number },
    title,
    url: `https://github.com/${repository}/pull/${number}`,
    author: "sam",
    updatedAt: new Date(NOW).toISOString(),
  };
}

function facts(overrides: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    headSha: "head1",
    reviewDecision: null,
    checks: "passing",
    createdAt: new Date(NOW - 3_600_000).toISOString(),
    isMerged: false,
    ...overrides,
  };
}

const ALL_REPOSITORIES = {
  others: [request("acme/app", 1), request("acme/app", 2)],
  dependabot: [
    request("acme/app", 10, "Bump vite from 5.4.1 to 5.4.2"),
    request("acme/app", 11, "Group update"),
  ],
  smartling: [request("acme/web", 20)],
};

beforeEach(() => {
  fakes.store = new SessionStore(":memory:");
  fakes.reviewRequests = async () => [request("acme/app", 1)];
  fakes.openPullRequests = async (authorship) =>
    ALL_REPOSITORIES[authorship as keyof typeof ALL_REPOSITORIES];
  fakes.pullRequestFacts = async (refs) =>
    Object.fromEntries(
      refs.map((ref) => {
        const { owner, repo, number } = ref as { owner: string; repo: string; number: number };
        return [`${owner}/${repo}#${number}`, facts()];
      }),
    );
});

describe("loadInbox", () => {
  it("lists each open PR once, with its facts, and counts the bot PRs", async () => {
    const inbox = await loadInbox();
    const keys = inbox.entries.map(
      (entry) => `${entry.request.ref.repo}#${entry.request.ref.number}`,
    );
    expect(keys).toEqual(["app#1", "app#2"]);
    expect(inbox.entries[0].facts?.additions).toBe(10);
    expect(inbox.waitingCount).toBe(1);
    expect(inbox.dependabot).toEqual({ patch: 1, minor: 0, major: 0, other: 1 });
    expect(inbox.smartlingCount).toBe(1);
    expect(inbox.requestsError).toBeNull();
  });

  it("reports a failed review-request search and keeps the rest of the inbox", async () => {
    fakes.reviewRequests = async () => {
      throw new Error("gh: not logged in");
    };
    const inbox = await loadInbox();
    expect(inbox.requestsError).toBe("gh: not logged in");
    expect(inbox.waitingCount).toBe(0);
    expect(inbox.entries.map((entry) => entry.request.ref.number)).toEqual([1, 2]);
  });

  it("keeps the PRs when GitHub facts cannot be read, without size or checks", async () => {
    fakes.pullRequestFacts = async () => {
      throw new Error("rate limited");
    };
    const inbox = await loadInbox();
    expect(inbox.entries).toHaveLength(2);
    expect(inbox.entries.every((entry) => entry.facts === null)).toBe(true);
  });

  it("adds started sessions that are not in any list, and drops merged ones", async () => {
    fakes.store.rememberTitle("acme/old#5", "Old work");
    fakes.store.setStepDone("acme/old#5", "s1", true);
    fakes.store.rememberTitle("acme/gone#6", "Merged work");
    fakes.store.setStepDone("acme/gone#6", "s1", true);
    fakes.pullRequestFacts = async (refs) =>
      Object.fromEntries(
        refs.map((ref) => {
          const { owner, repo, number } = ref as { owner: string; repo: string; number: number };
          return [`${owner}/${repo}#${number}`, facts({ isMerged: number === 6 })];
        }),
      );
    const inbox = await loadInbox();
    const sessionEntry = inbox.entries.find((entry) => entry.request.ref.repo === "old");
    expect(sessionEntry?.request.title).toBe("Old work");
    expect(sessionEntry?.progress?.doneCount).toBe(1);
    expect(inbox.entries.some((entry) => entry.request.ref.repo === "gone")).toBe(false);
  });

  it("returns snoozes and archived sessions, leaving out merged ones", async () => {
    fakes.store.snooze("acme/app#2", { headSha: "head1" });
    fakes.store.rememberTitle("acme/arch#7", "Archived work");
    fakes.store.setStepDone("acme/arch#7", "s1", true);
    fakes.store.archive("acme/arch#7");
    const inbox = await loadInbox();
    expect(inbox.snoozes).toEqual({ "acme/app#2": { headSha: "head1" } });
    expect(inbox.archived.map((entry) => entry.request.ref.repo)).toEqual(["arch"]);
  });
});

const LLM_CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  backend: "local" as const,
  thinking: true,
  timeoutMs: 1000,
};

describe("attachIntents", () => {
  it("adds the model's intent to a PR whose head already has an orientation, and nothing else", async () => {
    const store = new SessionStore(":memory:");
    const reply = { summary: "S", intent: "Adds retries.", risk: "low", stepOrder: [] };
    const fetchImpl = (async () => modelReply(JSON.stringify(reply))) as unknown as typeof fetch;
    const ref = { owner: "acme", repo: "app", number: 1 };
    const review = {
      pr: { ref, title: "T", body: "" },
      headSha: "head",
      files: [],
      steps: [],
      hotspots: [],
    } as unknown as ReviewData;
    await orientationFor(review, store, LLM_CONFIG, fetchImpl);
    const entry = (number: number, headSha: string): QueueEntry => ({
      request: { ref: { ...ref, number }, title: "T", url: "", author: "", updatedAt: "" },
      facts: { headSha } as QueueEntry["facts"],
      progress: null,
    });
    const attached = attachIntents([entry(1, "head"), entry(2, "head")], store, LLM_CONFIG);
    expect(attached.map((item) => item.intent)).toEqual(["Adds retries.", null]);
  });
});
