import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionStore } from "@/lib/session/store";
import { DependabotList } from "./bot-pull-request-list";

const fakes = vi.hoisted(() => ({
  store: null as unknown as SessionStore,
  openPullRequests: null as unknown as () => Promise<ReviewRequest[]>,
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/review/services", () => ({
  sessionStore: () => fakes.store,
  openPullRequests: () => fakes.openPullRequests(),
  pullRequestFacts: async (refs: { owner: string; repo: string; number: number }[]) =>
    Object.fromEntries(refs.map((ref) => [`${ref.owner}/${ref.repo}#${ref.number}`, facts()])),
}));

const NOW = Date.parse("2026-11-16T12:00:00.000Z");

function bump(number: number, title: string): ReviewRequest {
  return {
    ref: { owner: "acme", repo: "app", number },
    title,
    url: `https://github.com/acme/app/pull/${number}`,
    author: "app/dependabot",
    updatedAt: new Date(NOW).toISOString(),
  };
}

function facts(): PullRequestFacts {
  return {
    additions: 4,
    deletions: 2,
    changedFiles: 1,
    headSha: "head1",
    reviewDecision: null,
    checks: "passing",
    createdAt: new Date(NOW - 3_600_000).toISOString(),
    isClosed: false,
  };
}

async function renderDependabot() {
  render(<TooltipProvider>{await DependabotList({})}</TooltipProvider>);
}

describe("DependabotList", () => {
  beforeEach(() => {
    fakes.store = new SessionStore(":memory:");
    fakes.openPullRequests = async () => [bump(1, "Bump vite from 5.4.1 to 5.4.2")];
  });

  it("lists each bot PR with its version bump", async () => {
    await renderDependabot();
    expect(screen.getByText("patch 5.4.1 → 5.4.2")).toBeTruthy();
    expect(screen.getByText("acme/app#1")).toBeTruthy();
  });

  it("says nothing is open when the bot has no PRs", async () => {
    fakes.openPullRequests = async () => [];
    await renderDependabot();
    expect(screen.getByText(/Pick repositories in Settings/)).toBeTruthy();
  });

  it("shows the gh failure when the search fails", async () => {
    fakes.openPullRequests = async () => {
      throw new Error("gh: not logged in");
    };
    await renderDependabot();
    expect(screen.getByText("gh: not logged in")).toBeTruthy();
  });

  it("shows a snoozed bot PR with its snooze instead of the bump", async () => {
    fakes.store.snooze("acme/app#1", { headSha: "head1" });
    await renderDependabot();
    expect(screen.getByText("Snoozed until new commits")).toBeTruthy();
    expect(screen.queryByText("patch 5.4.1 → 5.4.2")).toBeNull();
  });
});
