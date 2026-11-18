import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionStore } from "@/lib/session/store";
import { DependabotList, SmartlingList } from "./bot-pull-request-list";

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
const DAY = 86_400_000;

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

async function renderDependabot(searchParams: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await DependabotList({ searchParams: Promise.resolve(searchParams) })}
    </TooltipProvider>,
  );
}

function renderedPullRequestNumbers(): string[] {
  return screen.getAllByText(/^acme\/\w+#\d+$/).map((element) => element.textContent ?? "");
}

function otherRepositoryBump(number: number, title: string): ReviewRequest {
  return { ...bump(number, title), ref: { owner: "acme", repo: "other", number } };
}

describe("DependabotList", () => {
  beforeEach(() => {
    fakes.store = new SessionStore(":memory:");
    fakes.openPullRequests = async () => [bump(1, "Bump vite from 5.4.1 to 5.4.2")];
  });

  it("orders the rows by last update for the sort in the URL", async () => {
    fakes.openPullRequests = async () => [
      {
        ...bump(1, "Bump vite from 5.4.1 to 5.4.2"),
        updatedAt: new Date(NOW - 5 * DAY).toISOString(),
      },
      { ...bump(2, "Bump zod from 3.1.0 to 3.2.0"), updatedAt: new Date(NOW - DAY).toISOString() },
      {
        ...bump(3, "Bump tsx from 4.1.0 to 4.2.0"),
        updatedAt: new Date(NOW - 3 * DAY).toISOString(),
      },
    ];
    await renderDependabot({ sort: "updated" });
    expect(renderedPullRequestNumbers()).toEqual(["acme/app#2", "acme/app#3", "acme/app#1"]);
  });

  it("shows the sort menu next to the repository filter", async () => {
    fakes.openPullRequests = async () => [
      bump(1, "Bump vite from 5.4.1 to 5.4.2"),
      bump(2, "Bump zod from 3.1.0 to 3.2.0"),
    ];
    await renderDependabot();
    expect(screen.getByRole("button", { name: "Sort: Recommended" })).toBeTruthy();
  });

  it("keeps the chosen sort in the repository links", async () => {
    fakes.openPullRequests = async () => [
      bump(1, "Bump vite from 5.4.1 to 5.4.2"),
      otherRepositoryBump(2, "Bump zod from 3.1.0 to 3.2.0"),
    ];
    await renderDependabot({ sort: "updated" });
    await userEvent.click(screen.getByRole("button", { name: "Repository: All repositories" }));
    expect(
      within(screen.getByRole("navigation", { name: "Filter by repository" }))
        .getByRole("link", { name: "acme/other" })
        .getAttribute("href"),
    ).toBe("/dependabot?repository=acme%2Fother&sort=updated");
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

describe("SmartlingList", () => {
  beforeEach(() => {
    fakes.store = new SessionStore(":memory:");
  });

  it("orders the rows by the sort in the URL and shows the sort menu", async () => {
    fakes.openPullRequests = async () => [
      {
        ...bump(1, "Update smartling-cli to 2.0.1"),
        updatedAt: new Date(NOW - 4 * DAY).toISOString(),
      },
      { ...bump(2, "Update smartling-cli to 2.0.2"), updatedAt: new Date(NOW - DAY).toISOString() },
    ];
    render(
      <TooltipProvider>
        {await SmartlingList({ searchParams: Promise.resolve({ sort: "updated" }) })}
      </TooltipProvider>,
    );
    expect(renderedPullRequestNumbers()).toEqual(["acme/app#2", "acme/app#1"]);
    expect(screen.getByRole("button", { name: "Sort: Recently updated" })).toBeTruthy();
  });
});
