import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InboxPage from "./page";

vi.mock("@/components/inbox/inbox-resume", () => ({ InboxResume: () => <p>Resume panel</p> }));
vi.mock("@/components/inbox/inbox-list", () => ({ InboxList: () => <p>Queue panel</p> }));
vi.mock("@/components/inbox/open-pull-request-form", () => ({
  OpenPullRequestForm: () => <p>Open by URL form</p>,
}));

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("InboxPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lays the inbox out as a resume panel beside the waiting queue", () => {
    render(<InboxPage />);
    const resume = screen.getByRole("region", { name: "Pick Up Where You Left Off" });
    expect(resume.contains(screen.getByText("Resume panel"))).toBe(true);
    expect(resume.contains(screen.getByText("Queue panel"))).toBe(false);
  });

  it("gives the resume panel one constrained row so its region can scroll inside it", () => {
    render(<InboxPage />);
    const resume = screen.getByRole("region", { name: "Pick Up Where You Left Off" });
    expect(resume.classList.contains("grid-rows-1")).toBe(true);
  });

  it("gives the resume panel the 5 to 6 share of the width from the mockup", () => {
    render(<InboxPage />);
    expect(screen.getByRole("main").classList.contains("grid-cols-[5fr_6fr]")).toBe(true);
  });

  it("stretches both panels to the full height of the page", () => {
    render(<InboxPage />);
    expect(screen.getByRole("main").classList.contains("items-stretch")).toBe(true);
  });

  it("gives the waiting lists the free height and keeps the URL form below them", () => {
    render(<InboxPage />);
    const waiting = screen.getByRole("region", { name: "Waiting for You" });
    expect(waiting.classList.contains("grid-rows-[minmax(0,1fr)_auto]")).toBe(true);
  });

  it("keeps the Open Any PR by URL form in the waiting panel", () => {
    render(<InboxPage />);
    const waiting = screen.getByRole("region", { name: "Waiting for You" });
    expect(waiting.contains(screen.getByText("Queue panel"))).toBe(true);
    expect(waiting.contains(screen.getByText("Open by URL form"))).toBe(true);
  });
});
