import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, makeAssignedStory } from "@/test/fake-api";
import { AssignedTickets } from "./assigned-tickets";

const STORIES = [
  makeAssignedStory({ id: "31", title: "Plan the rollout" }),
  makeAssignedStory({
    id: "32",
    title: "Write the runbook",
    state: "Ready for Review",
    statePosition: 4,
  }),
  makeAssignedStory({
    id: "21",
    title: "Ship tally",
    state: "Done",
    stateType: "done",
    statePosition: 5,
    completedAt: "2026-10-29T09:00:00Z",
  }),
];

function renderTickets(api = fakeApi({ fetchAssignedStories: async () => STORIES })) {
  return render(<AssignedTickets api={api} />);
}

function readHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
}

describe("AssignedTickets", () => {
  it("groups every assigned ticket by workflow state by default", async () => {
    renderTickets();

    const inProgress = await screen.findByRole("region", { name: "In Progress" });
    expect(within(inProgress).getByRole("link", { name: "Plan the rollout" })).toBeDefined();
    expect(readHeadings()).toEqual(["In Progress (1)", "Ready for Review (1)", "Done (1)"]);
    expect(screen.getByText(/Completed Thu 29 Oct/)).toBeDefined();
  });

  it("names the page heading with its ticket count", async () => {
    renderTickets();

    expect(await screen.findByRole("heading", { level: 1, name: "Tickets (3)" })).toBeDefined();
  });

  it("keeps the sync button focusable and announces the sync while it runs", async () => {
    let finishSync: () => void = () => {};
    const runSync = vi.fn(
      () =>
        new Promise<{ errors: Record<string, string>; uncountedReviewRepos: string[] }>(
          (resolve) => {
            finishSync = () => resolve({ errors: {}, uncountedReviewRepos: [] });
          },
        ),
    );
    renderTickets(fakeApi({ fetchAssignedStories: async () => STORIES, runSync }));
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.click(screen.getByRole("button", { name: "Sync tickets" }));

    const syncButton = screen.getByRole("button", { name: "Syncing tickets…" });
    expect(syncButton.getAttribute("aria-disabled")).toBe("true");
    expect(syncButton.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Syncing tickets…");
    finishSync();
    expect(await screen.findByRole("button", { name: "Sync tickets" })).toBeDefined();
  });

  it("shows the sc id, story type and estimate on each card", async () => {
    renderTickets();

    const lane = await screen.findByRole("region", { name: "In Progress" });
    expect(within(lane).getByText("sc-31")).toBeDefined();
    expect(within(lane).getByText("feature")).toBeDefined();
    expect(within(lane).getByText("3 pt")).toBeDefined();
  });

  it("groups by state type or not at all", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    await userEvent.click(screen.getByRole("button", { name: "State type" }));
    expect(readHeadings()).toEqual(["Started (2)", "Done (1)"]);

    await userEvent.click(screen.getByRole("button", { name: "Nothing" }));
    expect(readHeadings()).toEqual(["All tickets (3)"]);
  });

  it("filters by state type or by one workflow state from the pills", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    await userEvent.click(screen.getByRole("button", { name: /^Any started/ }));
    expect(readHeadings()).toEqual(["In Progress (1)", "Ready for Review (1)"]);

    await userEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(readHeadings()).toEqual(["Done (1)"]);
    expect(screen.queryByRole("link", { name: "Plan the rollout" })).toBeNull();
  });

  it("marks the pill for the chosen status as pressed", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    expect(screen.getByRole("button", { name: /^All statuses/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: /^Ready for Review/ }));
    expect(
      screen.getByRole("button", { name: /^Ready for Review/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: /^All statuses/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("offers each state present, under its state type", async () => {
    renderTickets();
    await screen.findByRole("region", { name: "In Progress" });

    const started = screen.getByRole("group", { name: "Started" });
    expect(
      within(started)
        .getAllByRole("button")
        .map((pill) => pill.textContent?.replace(/\d+$/, "")),
    ).toEqual(["Any started", "In Progress", "Ready for Review"]);
  });

  it("says so when nothing matches or nothing is assigned", async () => {
    renderTickets(fakeApi({ fetchAssignedStories: async () => [] }));

    expect(await screen.findByText(/No tickets here/)).toBeDefined();
  });

  it("shows a load failure", async () => {
    renderTickets(
      fakeApi({
        fetchAssignedStories: async () => {
          throw new Error("boom");
        },
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("boom");
  });

  it("renders Markdown in story titles", async () => {
    renderTickets(
      fakeApi({
        fetchAssignedStories: async () => [makeAssignedStory({ title: "Fix `parse` crash" })],
      }),
    );

    expect((await screen.findByText("parse")).tagName).toBe("CODE");
  });

  it("syncs from Shortcut and reloads the tickets", async () => {
    const runSync = vi.fn(async () => ({ errors: {}, uncountedReviewRepos: [] }));
    const fetchAssignedStories = vi.fn(async () => STORIES);
    renderTickets(fakeApi({ fetchAssignedStories, runSync }));
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.click(screen.getByRole("button", { name: "Sync tickets" }));

    await waitFor(() => expect(fetchAssignedStories).toHaveBeenCalledTimes(2));
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("shows why a sync failed", async () => {
    renderTickets(
      fakeApi({
        runSync: async () => {
          throw new Error("Shortcut is unreachable");
        },
      }),
    );
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.click(screen.getByRole("button", { name: "Sync tickets" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Shortcut is unreachable");
  });

  it("shows the source errors a sync reports", async () => {
    renderTickets(
      fakeApi({
        runSync: async () => ({ errors: { shortcut: "token expired" }, uncountedReviewRepos: [] }),
      }),
    );
    await screen.findByRole("region", { name: "In Progress" });

    fireEvent.click(screen.getByRole("button", { name: "Sync tickets" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Shortcut: token expired");
  });
});
