import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FIXED_NOW, fakeApi, makeSettings, makeSummary } from "@/test/fake-api";
import type { SyncResult } from "@/lib/sync";
import { Dashboard } from "./dashboard";

const now = () => FIXED_NOW;

describe("Dashboard", () => {
  it("shows this week's figures, ticket cards and chart once loaded", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    expect(await screen.findByRole("img", { name: "7 PRs reviewed" })).toBeDefined();
    expect(screen.getByRole("article", { name: "sc-31" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Your Tickets" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Open PRs Without a Ticket" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Reviewing" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Completed This Week" })).toBeDefined();
    expect(screen.getByRole("region", { name: "The Last Four Weeks, in Scribbles" })).toBeDefined();
    expect(screen.queryByText("PRs reviewed", { selector: "h3" })).toBeNull();
    expect(screen.getByRole("button", { name: "This week" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("Synced 5 minutes ago")).toBeDefined();
  });

  it("greets with the tally headline", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Hey There. Here's Your Tally.",
    });
    expect(heading.querySelector("span")?.className).toContain("text-neon-tally");
  });

  it("ends the overview with an encouraging note beside a tally mark", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    const note = await screen.findByText("Tiny scribbles still add up. Go easy on yourself today.");
    expect(note.querySelector("svg.tally-mark")).not.toBeNull();
  });

  it("loads the chosen range", async () => {
    const fetchSummary = vi.fn(async (range) => makeSummary({ range }));
    render(<Dashboard api={fakeApi({ fetchSummary })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    await waitFor(() => expect(fetchSummary).toHaveBeenLastCalledWith("day"));
    expect(screen.getByRole("button", { name: "Today" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("syncs on load when the data is stale, then reloads", async () => {
    const stale = makeSummary({ lastSyncedAt: "2026-10-30T09:00:00Z" });
    const fetchSummary = vi.fn(async () => stale);
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: [] }));
    render(<Dashboard api={fakeApi({ fetchSummary, runSync })} now={now} />);

    await waitFor(() => expect(runSync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchSummary).toHaveBeenCalledTimes(2));
  });

  it("does not sync on load when the data is fresh", async () => {
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: [] }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    expect(runSync).not.toHaveBeenCalled();
  });

  it("syncs on demand and reports which source failed", async () => {
    const runSync = vi.fn(async () => ({
      errors: { github: "gh exploded" },
      uncountedReviewRepos: [],
    }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect((await screen.findByRole("alert")).textContent).toContain("GitHub: gh exploded");
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("names repos whose reviews are not counted", async () => {
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: ["stranger/lib"] }));
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect((await screen.findByRole("alert")).textContent).toContain("stranger/lib");
  });

  it("asks for an allow-list before there is anything to count", async () => {
    const fetchSettings = async () => makeSettings({ allowList: [] });
    render(
      <Dashboard
        api={fakeApi({
          fetchSettings,
          fetchSummary: async () => makeSummary({ lastSyncedAt: null }),
        })}
        now={now}
      />,
    );

    const link = await screen.findByRole("link", { name: "Choose them in settings" });
    expect(link.getAttribute("href")).toBe("/settings");
  });

  it("keeps the setup note and problems in a first Notices panel", async () => {
    const fetchSettings = async () => makeSettings({ allowList: [] });
    const runSync = vi.fn(async () => ({
      errors: { github: "gh exploded" },
      uncountedReviewRepos: [],
    }));
    render(<Dashboard api={fakeApi({ fetchSettings, runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    const notices = await screen.findByRole("region", { name: "Notices" });
    expect(within(notices).getByText(/No GitHub orgs or repos are counted yet/)).toBeDefined();
    expect(within(notices).getByRole("alert").textContent).toContain("GitHub: gh exploded");
    expect(screen.getByRole("region", { name: "Overview" })).toBeDefined();
  });

  it("has no Notices panel when there is nothing to say", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    await screen.findByRole("img", { name: "7 PRs reviewed" });
    expect(screen.queryByRole("region", { name: "Notices" })).toBeNull();
  });

  it("shows a playful note while the summary loads", async () => {
    render(<Dashboard api={fakeApi()} now={now} />);

    expect(screen.getByText("Sharpening pencils…")).toBeDefined();
    await screen.findByRole("img", { name: "7 PRs reviewed" });
  });

  it("says it is counting while a sync runs", async () => {
    let finishSync: (result: SyncResult) => void = () => {};
    const runSync = vi.fn(
      () =>
        new Promise<SyncResult>((resolve) => {
          finishSync = resolve;
        }),
    );
    render(<Dashboard api={fakeApi({ runSync })} now={now} />);
    await screen.findByRole("img", { name: "7 PRs reviewed" });

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    const syncButton = screen.getByRole("button", { name: "Counting sheep…" });
    expect(syncButton.getAttribute("aria-disabled")).toBe("true");
    expect(syncButton.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Counting sheep…");
    finishSync({ errors: {}, uncountedReviewRepos: [] });
    expect(await screen.findByRole("button", { name: "Sync now" })).toBeDefined();
  });

  it("shows why loading failed", async () => {
    const fetchSummary = async () => {
      throw new Error("database is locked");
    };
    render(<Dashboard api={fakeApi({ fetchSummary })} now={now} />);

    expect((await screen.findByRole("alert")).textContent).toContain("database is locked");
  });
});
