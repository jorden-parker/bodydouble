import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { InboxList } from "./inbox-list";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/review/services", () => ({
  reviewRequests: vi.fn(),
  openPullRequests: vi.fn(),
  sessionStore: vi.fn(),
}));
vi.mock("@/lib/settings/repository-settings", () => ({ savedRepositories: vi.fn() }));

const REQUEST: ReviewRequest = {
  ref: { owner: "acme", repo: "app", number: 7 },
  title: "Add retry",
  url: "https://github.com/acme/app/pull/7",
  author: "sam",
  updatedAt: "2026-10-28T09:00:00.000Z",
};

async function renderInbox(repository?: string) {
  const searchParams = repository ? Promise.resolve({ repository }) : undefined;
  render(await InboxList({ searchParams }), { wrapper: TooltipProvider });
}

beforeEach(() => {
  vi.mocked(reviewRequests).mockResolvedValue([REQUEST]);
  vi.mocked(openPullRequests).mockResolvedValue([]);
  vi.mocked(savedRepositories).mockReturnValue(["acme/app"]);
  vi.mocked(sessionStore).mockReturnValue({
    inProgress: () => [],
    archived: () => [],
    recentSubmissions: () => [],
    progressSummaries: () => ({}),
  } as unknown as ReturnType<typeof sessionStore>);
});

describe("InboxList rows", () => {
  it("tints the whole queued pull request row on hover, not only its link", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: /Add retry/ });
    const row = link.closest("li") as HTMLElement;
    expect(row.classList.contains("hover:bg-surface-2")).toBe(true);
    expect(row.classList.contains("has-[a:focus-visible]:bg-surface-2")).toBe(true);
    expect(link.className).not.toMatch(/hover:bg-/);
  });

  it("shows Start as a quiet label, not a button that hovers on its own", async () => {
    await renderInbox();
    const start = screen.getByText("Start");
    expect(start.closest('[data-slot="button"]')).toBeNull();
    expect(start.classList.contains("group-hover:text-fg")).toBe(true);
  });

  it("starts each queued pull request with a Start button inside its row link", async () => {
    await renderInbox();
    expect(within(screen.getByRole("link", { name: /Add retry/ })).getByText("Start")).toBeTruthy();
  });

  it("links each queued pull request to GitHub outside the row link", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: "Open acme/app#7 on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/pull/7");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.closest('a[href^="/pr/"]')).toBeNull();
  });

  it("separates the rows with dividers inside one list, with no fixed height cap", async () => {
    await renderInbox();
    const list = screen.getAllByRole("list")[0];
    expect(list.classList.contains("divide-y")).toBe(true);
    expect(list.className).not.toMatch(/\bmax-h-|\bh-\d/);
  });

  it("sets the row title in medium weight", async () => {
    await renderInbox();
    expect(screen.getByText("Add retry").closest(".font-medium")).not.toBeNull();
  });

  it("draws the queue as one bordered list card rather than separate rings", async () => {
    await renderInbox();
    const row = screen.getByRole("link", { name: /Add retry/ });
    const list = row.closest("ul") as HTMLElement;
    expect(list.classList.contains("border-line-soft")).toBe(true);
    expect(list.classList.contains("rounded-xl")).toBe(true);
    expect(row.classList.contains("ring-1")).toBe(false);
  });
});

describe("InboxList states", () => {
  it("leaves out the waiting queue when nothing waits, since the resume panel says nothing waits", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    await renderInbox();
    expect(screen.queryByRole("heading", { name: /Waiting for you/ })).toBeNull();
  });

  it("tints the GitHub error card with a destructive border", async () => {
    vi.mocked(reviewRequests).mockRejectedValue(new Error("gh is not logged in"));
    await renderInbox();
    const card = screen.getByText(/reach GitHub through/).closest('[data-slot="card"]');
    expect(card).not.toBeNull();
    const classes = (card as HTMLElement).classList;
    expect(classes.contains("border-destructive/40")).toBe(true);
    expect(classes.contains("ring-destructive/40")).toBe(false);
  });
});

const REPOSITORY_REQUEST: ReviewRequest = {
  ref: { owner: "acme", repo: "web", number: 3 },
  title: "Bump lodash",
  url: "https://github.com/acme/web/pull/3",
  author: "lee",
  updatedAt: "2026-10-27T09:00:00.000Z",
};

function repositorySection(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /Open in your repositories/ });
  return heading.closest("section") as HTMLElement;
}

describe("InboxList repositories", () => {
  it("lists open pull requests from your repositories in their own section", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REPOSITORY_REQUEST]);
    await renderInbox();
    expect(openPullRequests).toHaveBeenCalledWith("others");
    expect(within(repositorySection()).getByRole("link", { name: /Bump lodash/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Waiting for you/ })).toBeTruthy();
  });

  it("leaves out pull requests already waiting for you", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REQUEST]);
    await renderInbox();
    expect(screen.getAllByRole("link", { name: /Add retry/ })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /Open in your repositories \(0\)/ })).toBeTruthy();
  });

  it("links the repositories section to the Dependabot page", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: "Dependabot PRs" });
    expect(link.getAttribute("href")).toBe("/dependabot");
  });

  it("asks for repositories in Settings when none are saved", async () => {
    vi.mocked(savedRepositories).mockReturnValue([]);
    await renderInbox();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByRole("heading", { name: /Open in your repositories/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /Waiting for you/ })).toBeTruthy();
  });

  it("shows a repository failure only inside its section", async () => {
    vi.mocked(openPullRequests).mockRejectedValue(new Error("search failed"));
    await renderInbox();
    expect(screen.getByRole("link", { name: /Add retry/ })).toBeTruthy();
    expect(within(repositorySection()).getByText(/reach GitHub/)).toBeTruthy();
    expect(screen.getAllByText(/reach GitHub/)).toHaveLength(1);
  });

  it("summarises the batched Dependabot bumps and links to the Dependabot page", async () => {
    vi.mocked(openPullRequests).mockImplementation(async (authorship) =>
      authorship === "dependabot" ? [REPOSITORY_REQUEST, REQUEST] : [],
    );
    await renderInbox();
    expect(screen.getByText("2 dependency bumps, batched for later.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See Dependabot" }).getAttribute("href")).toBe(
      "/dependabot",
    );
  });

  it("leaves out the Dependabot summary when GitHub cannot list the bumps", async () => {
    vi.mocked(openPullRequests).mockImplementation(async (authorship) => {
      if (authorship === "dependabot") throw new Error("search failed");
      return [];
    });
    await renderInbox();
    expect(screen.queryByText(/batched for later/)).toBeNull();
  });

  it("asks for progress on the repository pull requests too", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([REPOSITORY_REQUEST]);
    const progressSummaries = vi.fn(() => ({}));
    vi.mocked(sessionStore).mockReturnValue({
      inProgress: () => [],
      archived: () => [],
      recentSubmissions: () => [],
      progressSummaries,
    } as unknown as ReturnType<typeof sessionStore>);
    await renderInbox();
    expect(progressSummaries).toHaveBeenCalledWith(
      expect.arrayContaining([prKey(REPOSITORY_REQUEST.ref)]),
    );
  });

  it("links the repositories section to the Smartling page", async () => {
    await renderInbox();
    const link = screen.getByRole("link", { name: "Smartling PRs" });
    expect(link.getAttribute("href")).toBe("/smartling");
  });

  it("summarises the batched Smartling updates and links to the Smartling page", async () => {
    vi.mocked(openPullRequests).mockImplementation(async (authorship) =>
      authorship === "smartling" ? [REPOSITORY_REQUEST] : [],
    );
    await renderInbox();
    expect(screen.getByText("1 translation update, batched for later.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See Smartling" }).getAttribute("href")).toBe(
      "/smartling",
    );
  });
});

describe("InboxList repository filter", () => {
  beforeEach(() => {
    vi.mocked(openPullRequests).mockImplementation(async (authorship) =>
      authorship === "others" ? [REPOSITORY_REQUEST] : [],
    );
  });

  it("offers every listed repository as a filter link, with all of them current at first", async () => {
    await renderInbox();
    const filter = screen.getByRole("navigation", { name: "Filter by repository" });
    const links = within(filter).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "All repositories",
      "acme/app",
      "acme/web",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/?repository=acme%2Fapp",
      "/?repository=acme%2Fweb",
    ]);
    expect(links[0].getAttribute("aria-current")).toBe("true");
  });

  it("shows only the chosen repository's pull requests in both sections", async () => {
    await renderInbox("acme/web");
    expect(screen.queryByRole("link", { name: /Add retry/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Bump lodash/ })).toBeTruthy();
    const filter = screen.getByRole("navigation", { name: "Filter by repository" });
    const current = within(filter).getByRole("link", { name: "acme/web" });
    expect(current.getAttribute("aria-current")).toBe("true");
  });

  it("leaves the filter out when every pull request is in one repository", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([]);
    await renderInbox();
    expect(screen.queryByRole("navigation", { name: "Filter by repository" })).toBeNull();
  });
});
