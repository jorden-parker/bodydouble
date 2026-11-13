import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DependabotPage from "./page";

vi.mock("@/components/inbox/dependabot-list", () => ({ DependabotList: () => null }));

describe("DependabotPage", () => {
  it("titles the page Dependabot", () => {
    render(<DependabotPage />);
    expect(screen.getByRole("heading", { name: "Dependabot", level: 1 })).toBeTruthy();
  });

  it("keeps the pull requests in one labelled panel", () => {
    render(<DependabotPage />);
    expect(screen.getByRole("region", { name: "Open Pull Requests" })).toBeTruthy();
  });
});
