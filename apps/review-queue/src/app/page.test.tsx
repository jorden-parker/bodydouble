import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InboxPage from "./page";

vi.mock("@/components/inbox/inbox-resume", () => ({ InboxResume: () => <p>Resume panel</p> }));
vi.mock("@/components/inbox/inbox-list", () => ({ InboxList: () => <p>Queue panel</p> }));
vi.mock("@/components/inbox/open-pull-request-form", () => ({
  OpenPullRequestForm: () => <p>Open by URL form</p>,
}));

describe("InboxPage", () => {
  it("lays the inbox out as a resume section beside the waiting queue", () => {
    render(<InboxPage />);
    const resume = screen.getByRole("region", { name: "Pick up where you left off" });
    expect(resume.contains(screen.getByText("Resume panel"))).toBe(true);
    expect(resume.contains(screen.getByText("Queue panel"))).toBe(false);
    const waiting = screen.getByRole("region", { name: "Waiting for you" });
    expect(waiting.contains(screen.getByText("Queue panel"))).toBe(true);
    expect(waiting.contains(screen.getByText("Resume panel"))).toBe(false);
  });

  it("places both sections in the main landmark", () => {
    render(<InboxPage />);
    const main = screen.getByRole("main");
    expect(main.contains(screen.getByRole("region", { name: "Pick up where you left off" }))).toBe(
      true,
    );
    expect(main.contains(screen.getByRole("region", { name: "Waiting for you" }))).toBe(true);
  });

  it("titles the page Inbox as its one h1", () => {
    render(<InboxPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeTruthy();
  });

  it("stacks on phones and becomes two columns from 1024px", () => {
    render(<InboxPage />);
    const columns = screen.getByRole("region", { name: "Waiting for you" }).parentElement;
    expect(columns?.classList.contains("grid")).toBe(true);
    expect(columns?.classList.contains("lg:grid-cols-[5fr_6fr]")).toBe(true);
  });

  it("keeps the Open any PR by URL form in the waiting section", () => {
    render(<InboxPage />);
    const waiting = screen.getByRole("region", { name: "Waiting for you" });
    expect(waiting.contains(screen.getByText("Open by URL form"))).toBe(true);
  });
});
