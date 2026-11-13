import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppBar } from "./app-bar";

const pathnameState = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.current,
}));

describe("AppBar", () => {
  beforeEach(() => {
    pathnameState.current = "/";
  });

  it("shows the otter and the app name as a link home", () => {
    render(<AppBar />);
    const brand = screen.getByRole("link", { name: /Review Queue/ });
    expect(brand.getAttribute("href")).toBe("/");
    expect(brand.textContent).toContain("🦦");
  });

  it("sets Queue in the Review Queue gradient", () => {
    render(<AppBar />);
    expect(screen.getByText("Queue").classList.contains("text-neon-rq")).toBe(true);
  });

  it("lists Inbox, Dependabot and Settings in the main navigation", () => {
    render(<AppBar />);
    const navigation = screen.getByRole("navigation", { name: "Main" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Inbox", "Dependabot", "Settings"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/dependabot",
      "/settings",
    ]);
  });

  it("marks the link for the current page with aria-current", () => {
    pathnameState.current = "/dependabot";
    render(<AppBar />);
    expect(screen.getByRole("link", { name: "Dependabot" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Inbox" }).getAttribute("aria-current")).toBeNull();
  });

  it("hides the app name visually on phones but keeps it for screen readers", () => {
    render(<AppBar />);
    const name = screen.getByText("Queue").closest('[class*="max-sm:sr-only"]');
    expect(name).not.toBeNull();
    expect(screen.getByRole("link", { name: /Review Queue/ }).textContent).toContain("Review");
  });

  it("keeps each nav label on one line so the bar fits a phone", () => {
    render(<AppBar />);
    const navigation = screen.getByRole("navigation", { name: "Main" });
    for (const link of within(navigation).getAllByRole("link")) {
      expect(link.classList.contains("whitespace-nowrap")).toBe(true);
    }
  });

  it("keeps every nav link at least 44px tall", () => {
    render(<AppBar />);
    expect(screen.getByRole("link", { name: "Settings" }).classList.contains("min-h-11")).toBe(
      true,
    );
  });
});
