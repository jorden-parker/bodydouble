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
  isDraft: false,
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
  it("titles the screen Review Queue with Queue in the review gradient", async () => {
    await renderResume();
    expect(screen.getByRole("heading", { level: 1, name: "Review Queue" })).toBeTruthy();
    expect(screen.getByText("Queue").classList.contains("text-neon-rq")).toBe(true);
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

  it("keeps the hero fixed and lets the In Progress region fill the rest without its own scroll box", async () => {
    await renderResume();
    const hero = screen.getByRole("heading", { level: 1, name: "Review Queue" }).closest("div");
    expect(hero?.parentElement?.classList.contains("shrink-0")).toBe(true);
    const region = screen
      .getByRole("heading", { name: "Add retry budget" })
      .closest(".flex-1.min-h-0");
    expect(region?.classList.contains("flex-1")).toBe(true);
    expect(region?.classList.contains("overflow-y-auto")).toBe(false);
  });

  it("links the resume button to the pull request", async () => {
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("href")).toBe("/pr/acme/billing/482");
  });

  it("makes Resume review the one neon action while a review is waiting", async () => {
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("data-variant")).toBe("neon");
  });
});

describe("InboxResume all clear", () => {
  it("shows Pond's Clear with an Open a PR by URL link when nothing waits", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    await renderResume();
    expect(screen.getByRole("heading", { name: "Pond’s Clear. Go Stretch." })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open a PR by URL/ }).getAttribute("href")).toBe("#pr");
  });

  it("keeps the ripple rings inside the hero, each growing only to the ring's box", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    const { container } = await renderResume();
    const rings = Array.from(container.querySelectorAll(".animate-ping"));
    expect(rings).toHaveLength(3);
    for (const ring of rings) {
      expect(ring.classList.contains("inset-1/4")).toBe(true);
      expect(ring.parentElement?.classList.contains("overflow-hidden")).toBe(true);
    }
    expect(rings[0].parentElement?.className).toContain("clamp(");
  });

  it("keeps Resume review soft so the Open a PR by URL link stays the only neon action", async () => {
    vi.mocked(reviewRequests).mockResolvedValue([]);
    await renderResume();
    const resume = screen.getByRole("link", { name: /Resume review/ });
    expect(resume.getAttribute("data-variant")).toBe("soft");
    expect(
      screen.getByRole("link", { name: /Open a PR by URL/ }).getAttribute("data-variant"),
    ).toBe("neon");
  });

  it("does not claim the pond is clear when GitHub could not be asked", async () => {
    vi.mocked(reviewRequests).mockRejectedValue(new Error("gh is not logged in"));
    await renderResume();
    expect(screen.queryByText(/Pond’s Clear/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Review Queue" })).toBeTruthy();
  });
});
