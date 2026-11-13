import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { AppBar } from "./app-bar";

describe("AppBar", () => {
  it("links to every page", () => {
    render(<AppBar />);

    const hrefs = Object.fromEntries(
      ["Dashboard", "Tickets", "Work Log", "Settings"].map((name) => [
        name,
        screen.getByRole("link", { name }).getAttribute("href"),
      ]),
    );
    expect(hrefs).toEqual({
      Dashboard: "/",
      Tickets: "/tickets",
      "Work Log": "/work",
      Settings: "/settings",
    });
  });

  it("marks the current page", () => {
    pathname.current = "/work";
    render(<AppBar />);

    expect(screen.getByRole("link", { name: "Work Log" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
  });

  it("names the app with a link home and the gradient brand", () => {
    pathname.current = "/settings";
    const { container } = render(<AppBar />);

    const home = screen.getByRole("link", { name: "Tally home" });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.querySelector(".text-neon-tally")?.textContent).toBe("Tally");
    expect(container.querySelector("header")).not.toBeNull();
  });
});
