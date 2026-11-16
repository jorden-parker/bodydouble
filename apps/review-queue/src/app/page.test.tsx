import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QueuePage from "./page";

vi.mock("@/components/inbox/queue-screen", () => ({ QueueScreen: () => <p>Queue panel</p> }));
vi.mock("@/components/inbox/open-pull-request-form", () => ({
  OpenPullRequestForm: () => <p>Open by URL form</p>,
}));

describe("QueuePage", () => {
  it("shows the queue and the open-by-URL form inside the main landmark", () => {
    render(<QueuePage />);
    const main = screen.getByRole("main");
    expect(main.contains(screen.getByText("Queue panel"))).toBe(true);
    expect(main.contains(screen.getByText("Open by URL form"))).toBe(true);
  });

  it("names the page Queue as its one h1", () => {
    render(<QueuePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Queue" })).toBeTruthy();
  });
});
