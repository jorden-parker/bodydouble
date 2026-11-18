import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import type { ProgressSummary } from "@/lib/session/store";
import type { Inbox } from "./inbox-data";
import { QueueScreen } from "./queue-screen";

const inboxState = vi.hoisted(() => ({ inbox: null as unknown as Inbox }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("./inbox-data", () => ({
  loadInbox: async () => inboxState.inbox,
  isPondClear: (inbox: { waitingCount: number; requestsError: string | null }) =>
    inbox.waitingCount === 0 && inbox.requestsError === null,
}));

const NOW = Date.now();
const HOUR = 3_600_000;

function request(number: number, repo = "app"): ReviewRequest {
  return {
    ref: { owner: "acme", repo, number },
    title: `Change ${number}`,
    url: `https://github.com/acme/${repo}/pull/${number}`,
    author: "sam",
    updatedAt: new Date(NOW).toISOString(),
  };
}

function facts(overrides: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    additions: 212,
    deletions: 48,
    changedFiles: 9,
    headSha: "head1",
    checks: "passing",
    createdAt: new Date(NOW - 2 * 24 * HOUR).toISOString(),
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

function inboxWith(overrides: Partial<Inbox> = {}): Inbox {
  return {
    loadedAt: new Date(NOW).toISOString(),
    waitingCount: 5,
    requestsError: null,
    entries: [],
    repositoryError: null,
    isRepositoryListCapped: false,
    bots: {
      dependabot: { entries: [], error: null },
      smartling: { entries: [], error: null },
    },
    hasRepositories: true,
    snoozes: {},
    archived: [],
    posted: [],
    isPrepareNextOn: false,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW - days * 24 * HOUR).toISOString();
}

async function Screen(searchParams: Record<string, string> = {}) {
  return (
    <TooltipProvider>
      {await QueueScreen({ searchParams: Promise.resolve(searchParams) })}
    </TooltipProvider>
  );
}

function readWaitingTitles(): string[] {
  const heading = screen.getByRole("heading", { name: /^Waiting/ });
  const section = heading.closest("section") as HTMLElement;
  return within(section)
    .getAllByText(/^Change \d+$/)
    .map((element) => element.textContent ?? "");
}

const waitingEntries = [
  {
    request: request(7),
    facts: facts({ additions: 4, deletions: 1, createdAt: daysAgo(1) }),
    progress: null,
  },
  {
    request: request(8),
    facts: facts({ additions: 300, deletions: 0, createdAt: daysAgo(10) }),
    progress: null,
  },
  {
    request: request(9),
    facts: facts({ additions: 20, deletions: 0, createdAt: daysAgo(5) }),
    progress: null,
  },
  {
    request: request(10),
    facts: facts({ additions: 40, deletions: 0, createdAt: daysAgo(3) }),
    progress: null,
  },
];

function botEntry(number: number, title: string) {
  return { request: { ...request(number), title }, facts: facts(), progress: null };
}

function inboxWithBots(overrides: Partial<Inbox> = {}): Inbox {
  return inboxWith({
    entries: waitingEntries,
    bots: {
      dependabot: { entries: [botEntry(30, "Bump vite from 5.4.1 to 5.4.2")], error: null },
      smartling: { entries: [botEntry(40, "Update translations")], error: null },
    },
    ...overrides,
  });
}

function botsFold(): HTMLElement {
  return screen.getByText("Bots").closest("details") as HTMLElement;
}

async function openSortMenu() {
  await userEvent.click(screen.getByRole("button", { name: /^Sort:/ }));
}

describe("QueueScreen", () => {
  beforeEach(() => {
    inboxState.inbox = inboxWith({
      entries: [
        {
          request: request(1),
          facts: facts(),
          progress: progress({
            pause: { note: "check worker.ts", at: new Date(NOW - HOUR).toISOString() },
          }),
        },
        {
          request: request(2),
          facts: facts({ headSha: "head2" }),
          progress: progress({ lastHeadSha: "head1" }),
        },
        { request: request(3), facts: facts(), progress: progress() },
        { request: request(4), facts: facts({ checks: "failing" }), progress: null },
        {
          request: request(5),
          facts: facts({ checks: "passing", additions: 4, deletions: 1 }),
          progress: null,
        },
        { request: request(6), facts: facts(), progress: null },
      ],
      snoozes: { "acme/app#6": { at: new Date(NOW + HOUR).toISOString() } },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lists every PR exactly once across Up next, Continue, New commits, Waiting and Later", async () => {
    render(await Screen());
    for (const number of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getAllByText(`acme/app#${number}`)).toHaveLength(1);
    }
  });

  it("picks the smallest passing PR when nothing is paused or started", async () => {
    inboxState.inbox = inboxWith({
      entries: [
        { request: request(4), facts: facts({ checks: "failing" }), progress: null },
        { request: request(5), facts: facts({ additions: 4, deletions: 1 }), progress: null },
      ],
    });
    render(await Screen());
    const hero = screen.getByRole("region", { name: "Up next" });
    expect(hero.textContent).toContain("acme/app#5");
    expect(hero.textContent).toContain("Picked because it is small, checks pass");
  });

  it("shows the step as Step N of M and the size and checks in words", async () => {
    render(await Screen());
    expect(screen.getAllByText("Step 3 of 9").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Checks failing").length).toBe(1);
    expect(screen.getAllByText("Checks pass").length).toBeGreaterThan(0);
  });

  it("shows when each PR was created and last updated", async () => {
    inboxState.inbox = inboxWith({
      entries: [
        { request: request(7), facts: facts({ createdAt: daysAgo(5) }), progress: null },
        {
          request: { ...request(8), updatedAt: daysAgo(2) },
          facts: facts({ createdAt: daysAgo(3) }),
          progress: null,
        },
      ],
    });
    render(await Screen());
    expect(screen.getByText("created 5 d ago").getAttribute("datetime")).toBe(daysAgo(5));
    expect(screen.getByText("updated just now")).toBeTruthy();
    expect(screen.getByText("created 3 d ago")).toBeTruthy();
    expect(screen.getByText("updated 2 d ago").getAttribute("datetime")).toBe(daysAgo(2));
  });

  it("puts the model's one-line guess on the row and on Up next", async () => {
    inboxState.inbox = inboxWith({
      entries: [
        {
          request: request(5),
          facts: facts({ additions: 4, deletions: 1 }),
          progress: null,
          intent: "Adds a retry to the loader.",
        },
        {
          request: request(3),
          facts: facts(),
          progress: null,
          intent: "Adds a retry to the loader.",
        },
      ],
    });
    render(await Screen());
    expect(screen.getAllByText(/Adds a retry to the loader\./)).toHaveLength(2);
  });

  it("gives a Later row a Wake control that sends the wake action", async () => {
    const fetchImpl = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchImpl);
    const { container } = render(await Screen());
    fireEvent.click(container.querySelector('[data-queue-action="wake"]') as HTMLElement);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/session");
    expect(JSON.parse(String(init.body))).toEqual({ type: "wake" });
  });

  it("says when the repository list stopped at the first 100", async () => {
    inboxState.inbox = inboxWith({ isRepositoryListCapped: true });
    render(await Screen());
    expect(screen.getByText("Showing the first 100")).toBeTruthy();
  });

  it("says the pond is clear when nothing waits and GitHub answered", async () => {
    inboxState.inbox = inboxWith({ waitingCount: 0, entries: [] });
    render(await Screen());
    expect(screen.getByText("Nothing waiting for review")).toBeTruthy();
  });

  it("shows the gh failure instead of an empty pond", async () => {
    inboxState.inbox = inboxWith({ waitingCount: 0, requestsError: "gh: not logged in" });
    render(await Screen());
    expect(screen.getByText(/Couldn.t reach GitHub/)).toBeTruthy();
    expect(screen.queryByText("Nothing waiting for review")).toBeNull();
  });

  it("shows one failure when every list failed for the same reason", async () => {
    const reason = "GitHub did not answer, so the Queue could not be loaded. gh: HTTP 502";
    inboxState.inbox = inboxWith({
      waitingCount: 0,
      requestsError: reason,
      repositoryError: reason,
    });
    render(await Screen());
    expect(screen.getAllByText(reason)).toHaveLength(1);
  });

  it("orders the Waiting rows by the sort in the URL", async () => {
    inboxState.inbox = inboxWith({ entries: waitingEntries });
    const first = render(await Screen());
    const recommended = readWaitingTitles();
    first.unmount();
    render(await Screen({ sort: "oldest" }));
    expect(readWaitingTitles()).toEqual(["Change 9", "Change 10", "Change 7"]);
    expect(recommended).not.toEqual(["Change 9", "Change 10", "Change 7"]);
  });

  it("marks only the chosen sort link with aria-current", async () => {
    inboxState.inbox = inboxWith({ entries: waitingEntries });
    render(await Screen({ sort: "oldest" }));
    await openSortMenu();
    const sortNav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(sortNav).getByRole("link", { name: "Oldest first" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      within(sortNav).getByRole("link", { name: "Recommended" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      within(sortNav).getByRole("link", { name: "Newest first" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("orders the Waiting rows by last update for the updated sort", async () => {
    inboxState.inbox = inboxWith({
      entries: [
        { request: { ...request(7), updatedAt: daysAgo(5) }, facts: facts(), progress: null },
        { request: { ...request(8), updatedAt: daysAgo(1) }, facts: facts(), progress: null },
        { request: { ...request(9), updatedAt: daysAgo(10) }, facts: facts(), progress: null },
        { request: { ...request(10), updatedAt: daysAgo(3) }, facts: facts(), progress: null },
      ],
    });
    render(await Screen({ sort: "updated" }));
    expect(readWaitingTitles()).toEqual(["Change 10", "Change 7", "Change 9"]);
  });

  it("chooses Recommended when the URL has no sort", async () => {
    inboxState.inbox = inboxWith({ entries: waitingEntries });
    render(await Screen());
    await openSortMenu();
    const sortNav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(sortNav).getByRole("link", { name: "Recommended" }).getAttribute("aria-current"),
    ).toBe("true");
  });

  it("keeps the repository in sort links and the sort in repository links", async () => {
    inboxState.inbox = inboxWith({
      entries: [
        ...waitingEntries,
        { request: request(11, "other"), facts: facts(), progress: null },
      ],
    });
    render(await Screen({ repository: "acme/app", sort: "oldest" }));
    await openSortMenu();
    const sortNav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(within(sortNav).getByRole("link", { name: "Smallest first" }).getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=smallest",
    );
    expect(within(sortNav).getByRole("link", { name: "Recommended" }).getAttribute("href")).toBe(
      "/?repository=acme%2Fapp",
    );
    await userEvent.click(screen.getByRole("button", { name: "Repository: acme/app" }));
    const repositoryNav = screen.getByRole("navigation", { name: "Filter by repository" });
    expect(
      within(repositoryNav).getByRole("link", { name: "acme/other" }).getAttribute("href"),
    ).toBe("/?repository=acme%2Fother&sort=oldest");
    expect(
      within(repositoryNav).getByRole("link", { name: "All repositories" }).getAttribute("href"),
    ).toBe("/?sort=oldest");
  });

  it("points Recommended at / when no repository is chosen", async () => {
    inboxState.inbox = inboxWith({ entries: waitingEntries });
    render(await Screen({ sort: "newest" }));
    await openSortMenu();
    const sortNav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(within(sortNav).getByRole("link", { name: "Recommended" }).getAttribute("href")).toBe(
      "/",
    );
  });

  it("lists the Dependabot and Smartling PRs in the Bots fold, under the queue", async () => {
    inboxState.inbox = inboxWithBots();
    render(await Screen());
    const fold = botsFold();
    expect(within(fold).getByText("acme/app#30")).toBeTruthy();
    expect(within(fold).getByText("patch 5.4.1 → 5.4.2")).toBeTruthy();
    expect(within(fold).getByText("acme/app#40")).toBeTruthy();
    expect(within(fold).getByText("1 patch · 1 translation update")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Up next" })).toBeTruthy();
  });

  it("says so in the Bots fold when no bot PR is open", async () => {
    render(await Screen());
    expect(within(botsFold()).getByText("No bot pull requests are open.")).toBeTruthy();
  });

  it("leaves a bot PR out of the Bots fold when the queue already lists it", async () => {
    inboxState.inbox = inboxWithBots({
      entries: [...waitingEntries, botEntry(30, "Bump vite from 5.4.1 to 5.4.2")],
    });
    render(await Screen());
    expect(screen.getAllByText("acme/app#30")).toHaveLength(1);
    expect(within(botsFold()).queryByText("acme/app#30")).toBeNull();
  });

  it("keeps the Bots fold to the chosen repository", async () => {
    inboxState.inbox = inboxWithBots({
      bots: {
        dependabot: { entries: [botEntry(30, "Bump vite from 5.4.1 to 5.4.2")], error: null },
        smartling: {
          entries: [{ request: request(40, "other"), facts: facts(), progress: null }],
          error: null,
        },
      },
    });
    render(await Screen({ repository: "acme/app" }));
    expect(within(botsFold()).getByText("acme/app#30")).toBeTruthy();
    expect(screen.queryByText("acme/other#40")).toBeNull();
  });

  it("shows only the Dependabot PRs for ?bots=dependabot", async () => {
    inboxState.inbox = inboxWithBots();
    render(await Screen({ bots: "dependabot" }));
    expect(screen.getByText("acme/app#30")).toBeTruthy();
    expect(screen.queryByText("acme/app#40")).toBeNull();
    expect(screen.queryByText("acme/app#7")).toBeNull();
    expect(screen.queryByRole("region", { name: "Up next" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show: Dependabot" })).toBeTruthy();
  });

  it("shows only the Smartling PRs for ?bots=smartling and both bots for ?bots=both", async () => {
    inboxState.inbox = inboxWithBots();
    const first = render(await Screen({ bots: "smartling" }));
    expect(screen.getByText("acme/app#40")).toBeTruthy();
    expect(screen.queryByText("acme/app#30")).toBeNull();
    first.unmount();
    render(await Screen({ bots: "both" }));
    expect(screen.getByText("acme/app#30")).toBeTruthy();
    expect(screen.getByText("acme/app#40")).toBeTruthy();
    expect(screen.queryByText("acme/app#7")).toBeNull();
  });

  it("offers the bot filter on the queue, keeping the sort in its links", async () => {
    inboxState.inbox = inboxWithBots();
    render(await Screen({ sort: "oldest" }));
    await userEvent.click(screen.getByRole("button", { name: "Show: Everything" }));
    const botNav = screen.getByRole("navigation", { name: "Filter by bot" });
    expect(within(botNav).getByRole("link", { name: "Dependabot" }).getAttribute("href")).toBe(
      "/?sort=oldest&bots=dependabot",
    );
  });

  it("treats an unknown sort as Recommended", async () => {
    inboxState.inbox = inboxWith({ entries: waitingEntries });
    const first = render(await Screen());
    const recommended = readWaitingTitles();
    first.unmount();
    render(await Screen({ sort: "bogus" }));
    expect(readWaitingTitles()).toEqual(recommended);
    await openSortMenu();
    const sortNav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(sortNav).getByRole("link", { name: "Recommended" }).getAttribute("aria-current"),
    ).toBe("true");
  });
});
