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

  it("marks the link for the current page with aria-current and the tab underline", () => {
    pathnameState.current = "/dependabot";
    render(<AppBar />);
    const current = screen.getByRole("link", { name: "Dependabot" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.classList.contains("is-current")).toBe(true);
    expect(screen.getByRole("link", { name: "Inbox" }).getAttribute("aria-current")).toBeNull();
  });

  it("keeps the nav in a horizontally scrolling strip rather than wrapping", () => {
    render(<AppBar />);
    expect(
      screen.getByRole("navigation", { name: "Main" }).classList.contains("app-bar__nav"),
    ).toBe(true);
  });
});
