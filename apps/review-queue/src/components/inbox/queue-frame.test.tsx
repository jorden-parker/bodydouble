import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueueFrame } from "./queue-frame";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

describe("QueueFrame", () => {
  it("says how long ago the queue was loaded in minutes once a minute has passed", () => {
    const loadedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    render(<QueueFrame loadedAt={loadedAt}>{null}</QueueFrame>);
    const status = document.querySelector("[aria-live='polite']");
    expect(status?.textContent).toBe("Updated 2 min ago");
  });

  it("says it was updated just now when the queue loaded a few seconds ago", () => {
    const loadedAt = new Date(Date.now() - 5_000).toISOString();
    render(<QueueFrame loadedAt={loadedAt}>{null}</QueueFrame>);
    expect(screen.getByText("Updated just now")).toBeTruthy();
  });
});
