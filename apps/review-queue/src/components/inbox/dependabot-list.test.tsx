import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { REVIEW_REQUEST_LIMIT, type ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { DependabotList } from "./dependabot-list";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/review/services", () => ({ openPullRequests: vi.fn(), sessionStore: vi.fn() }));
vi.mock("@/lib/settings/repository-settings", () => ({ savedRepositories: vi.fn() }));

const BUMP: ReviewRequest = {
  ref: { owner: "acme", repo: "web", number: 3 },
  title: "Bump lodash",
  url: "https://github.com/acme/web/pull/3",
  author: "dependabot[bot]",
  updatedAt: "2026-10-27T09:00:00.000Z",
  isDraft: false,
};

async function renderList() {
  render(await DependabotList(), { wrapper: TooltipProvider });
}

beforeEach(() => {
  vi.mocked(openPullRequests).mockResolvedValue([BUMP]);
  vi.mocked(savedRepositories).mockReturnValue(["acme/web"]);
  vi.mocked(sessionStore).mockReturnValue({
    progressSummaries: () => ({}),
  } as unknown as ReturnType<typeof sessionStore>);
});

describe("DependabotList", () => {
  it("lists the open Dependabot pull requests", async () => {
    await renderList();
    expect(openPullRequests).toHaveBeenCalledWith("dependabot");
    expect(screen.getByRole("link", { name: /Bump lodash/ })).toBeTruthy();
  });

  it("shows the package and the version it moves from and to", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([
      { ...BUMP, title: "Bump lodash from 4.17.20 to 4.17.21" },
    ]);
    await renderList();
    expect(screen.getByText("lodash")).toBeTruthy();
    expect(screen.getByText("4.17.20 → 4.17.21")).toBeTruthy();
    expect(screen.getByText("acme/web #3")).toBeTruthy();
  });

  it("shows the title when it does not name one package and version", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([
      { ...BUMP, title: "Bump the npm_and_yarn group across 1 directory with 2 updates" },
    ]);
    await renderList();
    expect(screen.getAllByText(/Bump the npm_and_yarn group/).length).toBeGreaterThan(0);
    expect(screen.queryByText("→")).toBeNull();
  });

  it("offers Resume for a pull request already under review", async () => {
    vi.mocked(sessionStore).mockReturnValue({
      progressSummaries: () => ({
        [prKey(BUMP.ref)]: {
          doneCount: 2,
          noteCount: 0,
          lastHeadSha: null,
          updatedAt: "2026-10-27T10:00:00.000Z",
          pause: null,
        },
      }),
    } as unknown as ReturnType<typeof sessionStore>);
    await renderList();
    expect(screen.getByRole("link", { name: /Resume/ })).toBeTruthy();
    expect(screen.getByText("Resume, 2 steps done")).toBeTruthy();
  });

  it("says so when no Dependabot pull request is open", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([]);
    await renderList();
    expect(screen.getByText(/No Dependabot pull requests are open/)).toBeTruthy();
  });

  it("points to Settings when no repositories are selected", async () => {
    vi.mocked(openPullRequests).mockResolvedValue([]);
    vi.mocked(savedRepositories).mockReturnValue([]);
    await renderList();
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByText(/No Dependabot pull requests are open/)).toBeNull();
  });

  it("shows why GitHub could not be asked", async () => {
    vi.mocked(openPullRequests).mockRejectedValue(new Error("gh is not logged in"));
    await renderList();
    expect(screen.getByText(/reach GitHub through/)).toBeTruthy();
    expect(screen.getByText("gh is not logged in")).toBeTruthy();
  });

  it("notes when the list is cut at the limit", async () => {
    const full = Array.from({ length: REVIEW_REQUEST_LIMIT }, (_, index) => ({
      ...BUMP,
      ref: { owner: "acme", repo: "web", number: index + 1 },
    }));
    vi.mocked(openPullRequests).mockResolvedValue(full);
    await renderList();
    expect(screen.getByText(`Showing the first ${REVIEW_REQUEST_LIMIT}`)).toBeTruthy();
  });
});
