import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { AppBar } from "./app-bar";

describe("AppBar", () => {
  it("offers a skip link to the main content first", () => {
    render(<AppBar />);

    const skipLink = screen.getAllByRole("link")[0];
    expect(skipLink.textContent).toBe("Skip to content");
    expect(skipLink.getAttribute("href")).toBe("#main");
  });

  it("links to every page", () => {
    render(<AppBar />);

    const hrefs = Object.fromEntries(
      ["Dashboard", "Tickets", "Work log", "Settings"].map((name) => [
        name,
        screen.getByRole("link", { name }).getAttribute("href"),
      ]),
    );
    expect(hrefs).toEqual({
      Dashboard: "/",
      Tickets: "/tickets",
      "Work log": "/work",
      Settings: "/settings",
    });
  });

  it("underlines the current page as a tab, not a filled pill", () => {
    pathname.current = "/tickets";
    render(<AppBar />);

    expect(
      screen.getByRole("link", { name: "Tickets" }).classList.contains("app-tab-current"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Settings" }).classList.contains("app-tab-current"),
    ).toBe(false);
  });

  it("marks the current page", () => {
    pathname.current = "/work";
    render(<AppBar />);

    expect(screen.getByRole("link", { name: "Work log" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("names the app with a link home and the mark", () => {
    pathname.current = "/settings";
    const { container } = render(<AppBar />);

    const home = screen.getByRole("link", { name: "Tally home" });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.querySelector("span")?.textContent).toBe("Tally");
    expect(container.querySelector("header")).not.toBeNull();
  });
});
