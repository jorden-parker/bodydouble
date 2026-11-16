import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SmartlingPage from "./page";

vi.mock("@/components/inbox/dependabot-list", () => ({ SmartlingList: () => null }));

describe("SmartlingPage", () => {
  it("titles the page Smartling", () => {
    render(<SmartlingPage />);
    expect(screen.getByRole("heading", { name: "Smartling", level: 1 })).toBeTruthy();
  });

  it("keeps the pull requests in one labelled panel", () => {
    render(<SmartlingPage />);
    expect(screen.getByRole("region", { name: "Open pull requests" })).toBeTruthy();
  });
});
