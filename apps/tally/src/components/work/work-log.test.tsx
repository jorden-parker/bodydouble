import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, FIXED_NOW, makeWorkReport, makeWorkRow } from "@/test/fake-api";
import { WorkLog } from "./work-log";

const now = () => FIXED_NOW;

function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("WorkLog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the last 30 days by default", async () => {
    const fetchWork = vi.fn(async () => makeWorkReport({ from: "2026-10-01", to: "2026-10-30" }));

    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    await screen.findByRole("region", { name: "Timeline" });
    expect(fetchWork).toHaveBeenCalledWith({ from: "2026-10-01", to: "2026-10-30" });
  });

  it("leads with what was done in the period", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    expect(
      await screen.findByText("1 PR merged and 1 ticket completed, 1 Oct to 30 Oct"),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "2 things shipped." })).toBeDefined();
  });

  it("says which day of the week it is beside the progress stream", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    expect(await screen.findByText("Today is Fri")).toBeDefined();
  });

  it("shows where the week stands as a progress stream", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const week = await screen.findByRole("progressbar", { name: "Week progress" });
    expect(week.getAttribute("aria-valuetext")).toBe("Fri");
  });

  it("shows totals in two blocks with their type breakdown", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const totals = await screen.findByRole("region", { name: "Totals" });
    const pullRequests = within(totals).getByRole("group", { name: "Pull requests" });
    expect(within(pullRequests).getByText("+120 −30")).toBeDefined();
    const tickets = within(totals).getByRole("group", { name: "Tickets" });
    expect(within(tickets).getByText("3")).toBeDefined();
    expect(within(tickets).getByText("1 feature")).toBeDefined();
    expect(within(totals).getAllByText("2 days")).toHaveLength(2);
  });

  it("says what the totals leave out beneath each block", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      totals: { ...report.totals, prsWithoutSize: 2, unestimatedTickets: 1 },
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const totals = await screen.findByRole("region", { name: "Totals" });
    const pullRequests = within(totals).getByRole("group", { name: "Pull requests" });
    expect(within(pullRequests).getByText("2 PRs have no size data")).toBeDefined();
    const tickets = within(totals).getByRole("group", { name: "Tickets" });
    expect(within(tickets).getByText("1 ticket has no estimate")).toBeDefined();
  });

  it("lays merged PRs and completed tickets out day by day on one timeline", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(within(timeline).getByRole("heading", { level: 3, name: "Thu 29 Oct" })).toBeDefined();
    expect(within(timeline).getByRole("img", { name: "2 things" })).toBeDefined();
    expect(within(timeline).getByText("2", { selector: "[aria-hidden='true']" })).toBeDefined();
    expect(within(timeline).getByRole("link", { name: "Ship it" }).getAttribute("href")).toContain(
      "example.test",
    );
    for (const chip of ["acme/api", "+120 −30", "4 files", "merged in 2 days"]) {
      expect(within(timeline).getByText(chip)).toBeDefined();
    }
    expect(within(timeline).getByText("Merged")).toBeDefined();
    expect(within(timeline).getByText("sc-Ship tally")).toBeDefined();
    expect(within(timeline).getByText("Done")).toBeDefined();
    expect(within(timeline).getByText("finished in 2 days")).toBeDefined();
  });

  it("shows the PR number when the url has one", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      prs: [{ ...makeWorkRow("pr_merged", "Ship it"), url: "https://github.com/acme/api/pull/12" }],
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(within(timeline).getByText("#12")).toBeDefined();
  });

  it("says when the timeline is empty", async () => {
    const fetchWork = async () => ({
      ...makeWorkReport(),
      prs: [],
      tickets: [],
      upForReview: [],
      drafts: [],
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const timeline = await screen.findByRole("region", { name: "Timeline" });
    expect(within(timeline).getByText("A quiet stretch. Nothing here.")).toBeDefined();
    expect(screen.getByText("Nothing up for review.")).toBeDefined();
    expect(screen.getByText("No drafts on the go.")).toBeDefined();
  });

  it("lists PRs up for review with when they were opened and their review status", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const upForReview = await screen.findByRole("region", { name: "Up for review" });
    expect(within(upForReview).getByRole("heading", { name: "Up for review (1)" })).toBeDefined();
    expect(within(upForReview).getByRole("link", { name: "Count the sheep" })).toBeDefined();
    expect(
      within(upForReview).getByText("Opened Wed 28 Oct · acme/web · Awaiting review"),
    ).toBeDefined();
  });

  it("lists drafts in progress with when they were opened and their review status", async () => {
    const report = makeWorkReport();
    const [draft] = report.drafts;
    const fetchWork = async () => ({
      ...report,
      drafts: draft === undefined ? [] : [{ ...draft, reviewStatus: "awaiting_review" as const }],
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    const drafts = await screen.findByRole("region", { name: "Drafts in progress" });
    expect(within(drafts).getByRole("heading", { name: "Drafts in progress (1)" })).toBeDefined();
    expect(within(drafts).getByRole("link", { name: "Tidy the proxy" })).toBeDefined();
    expect(
      within(drafts).getByText("Opened Tue 20 Oct · acme/api · Awaiting review"),
    ).toBeDefined();
  });

  it("keeps drafts in their own panel so the summary never scrolls", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const drafts = await screen.findByRole("region", { name: "Drafts in progress" });
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(drafts.closest(".panel")).not.toBe(summary);
    expect(summary.contains(drafts)).toBe(false);
    expect(summary.querySelector(".overflow-y-auto")).toBeNull();
  });

  it("leaves the review status off a draft when it is unknown", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const drafts = await screen.findByRole("region", { name: "Drafts in progress" });
    expect(within(drafts).getByText("Opened Tue 20 Oct · acme/api")).toBeDefined();
  });

  it("reloads when the dates change", async () => {
    const fetchWork = vi.fn(async (period) => makeWorkReport(period));
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "Timeline" });

    setDate("From", "2026-07-01");

    await waitFor(() =>
      expect(fetchWork).toHaveBeenLastCalledWith({ from: "2026-07-01", to: "2026-10-30" }),
    );
  });

  it("asks for both dates instead of fetching when one is cleared", async () => {
    const fetchWork = vi.fn(async (period) => makeWorkReport(period));
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "Timeline" });

    setDate("To", "");

    expect((await screen.findByRole("alert")).textContent).toContain("Choose both dates");
    expect(screen.queryByRole("region", { name: "Timeline" })).toBeNull();
    expect(fetchWork).toHaveBeenCalledTimes(1);
  });

  it("shows why a period failed and hides the previous report", async () => {
    const fetchWork = vi.fn(async (period: { from: string; to: string }) => {
      if (period.from === "2026-11-01")
        throw new Error("Choose a from date on or before the to date.");
      return makeWorkReport(period);
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "Timeline" });

    setDate("From", "2026-11-01");

    expect((await screen.findByRole("alert")).textContent).toContain("on or before");
    expect(screen.queryByRole("region", { name: "Timeline" })).toBeNull();
  });

  it("clears the problem once a period loads", async () => {
    const fetchWork = vi.fn(async (period: { from: string; to: string }) => {
      if (period.from === "2026-11-01") throw new Error("Bad period");
      return makeWorkReport(period);
    });
    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);
    await screen.findByRole("region", { name: "Timeline" });
    setDate("From", "2026-11-01");
    await screen.findByRole("alert");

    setDate("From", "2026-10-02");

    await screen.findByRole("region", { name: "Timeline" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("copies the report as Markdown", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<WorkLog api={fakeApi()} now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy markdown" }));

    await screen.findByRole("button", { name: "Copied" });
    expect(screen.getByRole("status").textContent).toBe("Copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Work log: 2026-10-01"));
  });

  it("says when copying fails", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
    });
    render(<WorkLog api={fakeApi()} now={now} />);

    fireEvent.click(await screen.findByRole("button", { name: "Copy markdown" }));

    expect(await screen.findByRole("button", { name: "Copy failed" })).toBeDefined();
  });

  it("offers the report as a Markdown download named after the period", async () => {
    render(<WorkLog api={fakeApi()} now={now} />);

    const download = await screen.findByRole("link", { name: "Download .md" });

    expect(download.getAttribute("download")).toBe("work-log-2026-10-01-to-2026-10-30.md");
    expect(decodeURIComponent(download.getAttribute("href") ?? "")).toContain("## PRs merged (1)");
  });

  it("renders Markdown in row titles", async () => {
    const report = makeWorkReport();
    const fetchWork = async () => ({
      ...report,
      prs: [makeWorkRow("pr_merged", "Upgrade `next` to *16*")],
    });

    render(<WorkLog api={fakeApi({ fetchWork })} now={now} />);

    expect((await screen.findByText("next")).tagName).toBe("CODE");
    expect(screen.getByText("16").tagName).toBe("EM");
  });
});
