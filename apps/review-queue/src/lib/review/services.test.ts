import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, QueueLists, ReviewRequest } from "@/lib/github/gh";
import { saveRepositories } from "@/lib/settings/repository-settings";
import type { PullRequestRef } from "@/lib/types";

const github = vi.hoisted(() => ({
  viewerLookups: 0,
  viewerFailure: null as string | null,
  lists: null as unknown as QueueLists,
  queueLoads: [] as string[][],
  factsLoads: [] as string[][],
}));

const keyOf = (ref: PullRequestRef) => `${ref.owner}/${ref.repo}#${ref.number}`;

vi.mock("@/lib/github/gh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/github/gh")>()),
  listReviewComments: async () => [],
  listReviews: async () => [],
  viewerLogin: async () => {
    github.viewerLookups += 1;
    if (github.viewerFailure) throw new Error(github.viewerFailure);
    return "sam";
  },
  loadQueue: async (repositories: string[]) => {
    github.queueLoads.push(repositories);
    return github.lists;
  },
  listPullRequestFacts: async (refs: PullRequestRef[]) => {
    github.factsLoads.push(refs.map(keyOf));
    return Object.fromEntries(refs.map((ref) => [keyOf(ref), FACTS]));
  },
}));

process.env.REVIEW_QUEUE_DB = ":memory:";

const {
  conversationView,
  openPullRequests,
  pullRequestFacts,
  refreshGitHubCache,
  reviewRequests,
  sessionStore,
} = await import("./services");

const REF = { owner: "acme", repo: "app", number: 7 };

const FACTS: PullRequestFacts = {
  additions: 4,
  deletions: 2,
  changedFiles: 1,
  headSha: "head1",
  checks: "passing",
  createdAt: "2026-11-01T09:00:00Z",
  isClosed: false,
};

function request(number: number): ReviewRequest {
  return {
    ref: { ...REF, number },
    title: `PR ${number}`,
    url: `https://github.com/acme/app/pull/${number}`,
    author: "sam",
    updatedAt: "2026-11-01T09:00:00Z",
  };
}

describe("conversationView", () => {
  it("looks up the signed-in login again after a failure, then never again, even after Refresh", async () => {
    github.viewerFailure = "gh: not logged in";
    expect((await conversationView(REF)).viewer).toBeNull();
    github.viewerFailure = null;
    expect((await conversationView(REF)).viewer).toBe("sam");
    refreshGitHubCache();
    expect((await conversationView(REF)).viewer).toBe("sam");
    expect(github.viewerLookups).toBe(2);
  });
});

describe("the Queue", () => {
  beforeEach(() => {
    refreshGitHubCache();
    saveRepositories(sessionStore(), ["acme/app"]);
    github.queueLoads = [];
    github.factsLoads = [];
    github.lists = {
      waiting: [request(7)],
      others: [request(8)],
      dependabot: [request(9)],
      smartling: [],
    };
  });

  it("loads all four lists with one GitHub request for the picked repositories", async () => {
    const lists = await Promise.all([
      reviewRequests(),
      openPullRequests("others"),
      openPullRequests("dependabot"),
      openPullRequests("smartling"),
    ]);
    expect(lists).toEqual([[request(7)], [request(8)], [request(9)], []]);
    expect(github.queueLoads).toEqual([["acme/app"]]);
  });

  it("fails only the list GitHub could not answer", async () => {
    github.lists.others = new Error("GitHub could not list the open pull requests");
    await expect(openPullRequests("others")).rejects.toThrow(
      "GitHub could not list the open pull requests",
    );
    expect(await reviewRequests()).toEqual([request(7)]);
    expect(github.queueLoads).toHaveLength(1);
  });

  it("asks GitHub again after Refresh, and when the picked repositories change", async () => {
    await reviewRequests();
    refreshGitHubCache();
    await reviewRequests();
    saveRepositories(sessionStore(), ["acme/app", "acme/lib"]);
    await reviewRequests();
    expect(github.queueLoads).toEqual([["acme/app"], ["acme/app"], ["acme/app", "acme/lib"]]);
  });

  it("reads the facts of the same PRs once until Refresh", async () => {
    const facts = await pullRequestFacts([REF]);
    await pullRequestFacts([REF]);
    expect(facts).toEqual({ "acme/app#7": FACTS });
    expect(github.factsLoads).toEqual([["acme/app#7"]]);
  });
});
