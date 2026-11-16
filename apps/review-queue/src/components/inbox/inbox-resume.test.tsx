import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewRequest } from "@/lib/github/gh";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type { InProgressSession } from "@/lib/session/store";
import { InboxResume } from "./inbox-resume";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/lib/review/services", () => ({
  reviewRequests: vi.fn(),
  openPullRequests: vi.fn(),
  sessionStore: vi.fn(),
}));
vi.mock("@/lib/settings/repository-settings", () => ({ savedRepositories: vi.fn() }));

const QUEUED: ReviewRequest = {
  ref: { owner: "acme", repo: "app", number: 7 },
  title: "Add retry",
  url: "https://github.com/acme/app/pull/7",
  author: "sam",
  updatedAt: "2026-10-28T09:00:00.000Z",
};

const RESUME: InProgressSession = {
  key: "acme/billing#482",
  title: "Add retry budget",
  doneCount: 2,
  pauseNote: "check the backoff math",
  updatedAt: "2026-10-28T09:00:00.000Z",
};

async function renderResume() {
  return render(await InboxResume(), { wrapper: TooltipProvider });
}

beforeEach(() => {
  vi.mocked(reviewRequests).mockResolvedValue([QUEUED]);
  vi.mocked(openPullRequests).mockResolvedValue([]);
  vi.mocked(savedRepositories).mockReturnValue([]);
  vi.mocked(sessionStore).mockReturnValue({
    inProgress: () => [RESUME],
    archived: () => [],
    recentSubmissions: () => [],
    progressSummaries: () => ({}),
  } as unknown as ReturnType<typeof sessionStore>);
});

describe("InboxResume hero", () => {
  it("leaves the page title to the inbox page, so the resume panel has no h1", async () => {
    await renderResume();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});

describe("InboxResume in progress", () => {
  it("shows the first in-progress session as a resume card with its progress stream", async () => {
    await renderResume();
    expect(screen.getByRole("heading", { name: "Add retry budget" })).toBeTruthy();
    const stream = screen.getByRole("progressbar", { name: "Review progress" });
    expect(stream.getAttribute("aria-valuemax")).toBe("4");
    expect(stream.getAttribute("aria-valuenow")).toBe("2");
  });

  it("lets the resume card grow with its content, with no fixed height or inner scroll box", async () => {
    await renderResume();
    const card = screen.getByRole("heading", { name: "Add retry budget" }).closest("article");
    expect(card?.classList.contains("overflow-y-auto")).toBe(false);
    expect(card?.className).not.toMatch(/\bh-\d/);
  });

  it("links the resume button to the pull request", async () => {
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("href")).toBe("/pr/acme/billing/482");
  });

  it("makes Resume review the one primary action while a review is waiting", async () => {
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("data-variant")).toBe("default");
  });
});

describe("InboxResume all clear", () => {
  it("shows Nothing waiting for review with an Open any PR by URL link when nothing waits", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    await renderResume();
    expect(
      screen.getByRole("heading", { level: 2, name: "Nothing waiting for review" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open any PR by URL/ }).getAttribute("href")).toBe(
      "#pr",
    );
  });

  it("draws no decorative ripple rings, keeping the card flat", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    const { container } = await renderResume();
    expect(container.querySelectorAll(".animate-ping")).toHaveLength(0);
  });

  it("keeps Resume review soft so the Open any PR by URL link stays the only primary action", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("data-variant")).toBe("soft");
    expect(
      screen.getByRole("link", { name: /Open any PR by URL/ }).getAttribute("data-variant"),
    ).toBe("default");
  });

  it("does not claim nothing waits when GitHub could not be asked", async () => {
    vi.mocked(reviewRequests).mockRejectedValue(new Error("gh is not logged in"));
    await renderResume();
    expect(screen.queryByText(/Nothing waiting for review/)).toBeNull();
  });
});
