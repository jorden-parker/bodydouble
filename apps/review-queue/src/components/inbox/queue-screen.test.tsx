import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function request(number: number): ReviewRequest {
  return {
    ref: { owner: "acme", repo: "app", number },
    title: `Change ${number}`,
    url: `https://github.com/acme/app/pull/${number}`,
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
    reviewDecision: null,
    checks: "passing",
    createdAt: new Date(NOW - 2 * 24 * HOUR).toISOString(),
    isMerged: false,
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
    dependabot: null,
    smartlingCount: null,
    hasRepositories: true,
    snoozes: {},
    archived: [],
    posted: [],
    isPrepareNextOn: false,
    ...overrides,
  };
}

async function Screen() {
  return <TooltipProvider>{await QueueScreen({})}</TooltipProvider>;
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
});
