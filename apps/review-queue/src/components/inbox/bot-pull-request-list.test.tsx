import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BotFilter } from "./bot-filter";
import { BotPullRequestList } from "./bot-pull-request-list";
import type { Inbox } from "./inbox-data";
import type { QueueEntry, QueueSort } from "./queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const DAY = 86_400_000;

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

function bump(number: number, title: string, overrides: Partial<ReviewRequest> = {}): QueueEntry {
  return {
    request: {
      ref: { owner: "acme", repo: "app", number },
      title,
      url: `https://github.com/acme/app/pull/${number}`,
      author: "app/dependabot",
      updatedAt: new Date(NOW).toISOString(),
      ...overrides,
    },
    facts: facts(),
    progress: null,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}

type BotInbox = Pick<Inbox, "loadedAt" | "bots" | "snoozes" | "hasRepositories">;

function inboxWith(overrides: Partial<BotInbox> & { dependabot?: QueueEntry[] } = {}): BotInbox {
  const { dependabot = [bump(1, "Bump vite from 5.4.1 to 5.4.2")], ...rest } = overrides;
  return {
    loadedAt: new Date(NOW).toISOString(),
    bots: {
      dependabot: { entries: dependabot, error: null },
      smartling: { entries: [], error: null },
    },
    snoozes: {},
    hasRepositories: true,
    ...rest,
  };
}

function renderList(
  inbox: BotInbox,
  options: { botFilter?: NonNullable<BotFilter>; chosen?: string; sort?: QueueSort } = {},
) {
  render(
    <TooltipProvider>
      <BotPullRequestList
        inbox={inbox}
        botFilter={options.botFilter ?? "dependabot"}
        chosen={options.chosen ?? null}
        sort={options.sort ?? "recommended"}
      />
    </TooltipProvider>,
  );
}

function renderedPullRequestNumbers(): string[] {
  return screen.getAllByText(/^acme\/\w+#\d+$/).map((element) => element.textContent ?? "");
}

describe("BotPullRequestList", () => {
  it("orders the rows by last update for the chosen sort", () => {
    renderList(
      inboxWith({
        dependabot: [
          bump(1, "Bump vite from 5.4.1 to 5.4.2", { updatedAt: daysAgo(5) }),
          bump(2, "Bump zod from 3.1.0 to 3.2.0", { updatedAt: daysAgo(1) }),
          bump(3, "Bump tsx from 4.1.0 to 4.2.0", { updatedAt: daysAgo(3) }),
        ],
      }),
      { sort: "updated" },
    );
    expect(renderedPullRequestNumbers()).toEqual(["acme/app#2", "acme/app#3", "acme/app#1"]);
  });

  it("shows the bot filter and the sort menu above the rows", () => {
    renderList(
      inboxWith({
        dependabot: [
          bump(1, "Bump vite from 5.4.1 to 5.4.2"),
          bump(2, "Bump zod from 3.1.0 to 3.2.0"),
        ],
      }),
    );
    expect(screen.getByRole("button", { name: "Show: Dependabot" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sort: Recommended" })).toBeTruthy();
  });

  it("keeps the chosen sort and bot filter in the repository links", async () => {
    renderList(
      inboxWith({
        dependabot: [
          bump(1, "Bump vite from 5.4.1 to 5.4.2"),
          bump(2, "Bump zod from 3.1.0 to 3.2.0", {
            ref: { owner: "acme", repo: "other", number: 2 },
          }),
        ],
      }),
      { sort: "updated" },
    );
    await userEvent.click(screen.getByRole("button", { name: "Repository: All repositories" }));
    expect(
      within(screen.getByRole("navigation", { name: "Filter by repository" }))
        .getByRole("link", { name: "acme/other" })
        .getAttribute("href"),
    ).toBe("/?repository=acme%2Fother&sort=updated&bots=dependabot");
  });

  it("lists only the chosen repository's PRs", () => {
    renderList(
      inboxWith({
        dependabot: [
          bump(1, "Bump vite from 5.4.1 to 5.4.2"),
          bump(2, "Bump zod from 3.1.0 to 3.2.0", {
            ref: { owner: "acme", repo: "other", number: 2 },
          }),
        ],
      }),
      { chosen: "acme/other" },
    );
    expect(renderedPullRequestNumbers()).toEqual(["acme/other#2"]);
  });

  it("lists each bot PR with its version bump", () => {
    renderList(inboxWith());
    expect(screen.getByText("patch 5.4.1 → 5.4.2")).toBeTruthy();
    expect(screen.getByText("acme/app#1")).toBeTruthy();
  });

  it("lists only the bot the filter names", () => {
    const inbox = inboxWith();
    inbox.bots.smartling.entries = [bump(20, "Update translations")];
    renderList(inbox, { botFilter: "smartling" });
    expect(renderedPullRequestNumbers()).toEqual(["acme/app#20"]);
  });

  it("lists the PRs of both bots together for the both filter", () => {
    const inbox = inboxWith();
    inbox.bots.smartling.entries = [bump(20, "Update translations")];
    renderList(inbox, { botFilter: "both" });
    expect(renderedPullRequestNumbers().sort()).toEqual(["acme/app#1", "acme/app#20"]);
  });

  it("says nothing is open when the bot has no PRs, and keeps the bot filter", () => {
    renderList(inboxWith({ dependabot: [] }));
    expect(
      screen.getByText("No Dependabot pull requests are open. Nothing to update."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show: Dependabot" })).toBeTruthy();
  });

  it("points at Settings when no repositories are picked", () => {
    renderList(inboxWith({ dependabot: [], hasRepositories: false }), { botFilter: "both" });
    expect(
      screen.getByText(
        "Pick repositories in Settings to see their Dependabot and Smartling PRs here.",
      ),
    ).toBeTruthy();
  });

  it("shows the gh failure when the search fails", () => {
    const inbox = inboxWith({ dependabot: [] });
    inbox.bots.dependabot.error = "gh: not logged in";
    renderList(inbox);
    expect(screen.getByText("gh: not logged in")).toBeTruthy();
    expect(screen.queryByText(/No Dependabot pull requests are open/)).toBeNull();
  });

  it("says when a bot's list stopped at the first 100", () => {
    renderList(
      inboxWith({
        dependabot: Array.from({ length: 100 }, (_, index) =>
          bump(index + 1, "Bump vite from 5.4.1 to 5.4.2"),
        ),
      }),
    );
    expect(screen.getByText("Showing the first 100")).toBeTruthy();
  });

  it("shows a snoozed bot PR with its snooze instead of the bump", () => {
    renderList(inboxWith({ snoozes: { "acme/app#1": { headSha: "head1" } } }));
    expect(screen.getByText("Snoozed until new commits")).toBeTruthy();
    expect(screen.queryByText("patch 5.4.1 → 5.4.2")).toBeNull();
  });
});
