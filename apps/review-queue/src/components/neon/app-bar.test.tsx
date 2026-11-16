import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchModelStatus } from "@/components/review/api";
import { AppBar } from "./app-bar";

const pathnameState = vi.hoisted(() => ({ current: "/" }));

vi.mock("@/components/review/api", () => ({ fetchModelStatus: vi.fn(async () => null) }));

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

  it("lists Queue, Dependabot, Smartling and Settings in the main navigation", () => {
    render(<AppBar />);
    const navigation = screen.getByRole("navigation", { name: "Main" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Queue",
      "Dependabot",
      "Smartling",
      "Settings",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/dependabot",
      "/smartling",
      "/settings",
    ]);
  });

  it("marks the link for the current page with aria-current and the tab underline", () => {
    pathnameState.current = "/settings";
    render(<AppBar />);
    const current = screen.getByRole("link", { name: "Settings" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.classList.contains("is-current")).toBe(true);
    expect(screen.getByRole("link", { name: "Queue" }).getAttribute("aria-current")).toBeNull();
  });

  it("shows the model at the right, saying whether it is asleep, ready or busy", async () => {
    vi.mocked(fetchModelStatus).mockResolvedValue({
      isEnabled: true,
      backend: "local",
      server: "ollama",
      model: "qwen",
      size: "9B",
      isUsable: true,
      reason: null,
      isServerAnswering: true,
      isAwake: false,
      claudeModel: "haiku",
      lanes: { running: null, queued: { interactive: 0, background: 0 } },
      speeds: {
        reading: { tokensPerSecond: 170, isMeasured: false },
        writing: { tokensPerSecond: 13, isMeasured: false },
      },
    });
    render(<AppBar />);
    expect(await screen.findByText("9B asleep")).toBeTruthy();
  });

  it("keeps the nav in a horizontally scrolling strip rather than wrapping", () => {
    render(<AppBar />);
    expect(
      screen.getByRole("navigation", { name: "Main" }).classList.contains("app-bar__nav"),
    ).toBe(true);
  });
});
