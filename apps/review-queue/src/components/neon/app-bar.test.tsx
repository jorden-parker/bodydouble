import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchModelStatus, postModelStart } from "@/components/review/api";
import type { ModelStatus } from "@/lib/llm/model-status";
import { AppBar } from "./app-bar";

const pathnameState = vi.hoisted(() => ({ current: "/" }));

vi.mock("@/components/review/api", () => ({
  fetchModelStatus: vi.fn(async () => null),
  postModelStart: vi.fn(),
}));

const ASLEEP: ModelStatus = {
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
  start: { command: null, isStarting: false, failure: null },
};

const NOT_RUNNING: ModelStatus = {
  ...ASLEEP,
  isUsable: false,
  start: { command: "ollama serve", isStarting: false, failure: null },
};

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

  it("lists Queue and Settings in the main navigation", () => {
    render(<AppBar />);
    const navigation = screen.getByRole("navigation", { name: "Main" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Queue", "Settings"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/settings"]);
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
    vi.mocked(fetchModelStatus).mockResolvedValue(ASLEEP);
    render(<AppBar />);
    expect(await screen.findByText("9B asleep")).toBeTruthy();
  });

  it("starts a model that is not running, and shows it once it is up", async () => {
    vi.mocked(fetchModelStatus).mockResolvedValue(NOT_RUNNING);
    vi.mocked(postModelStart).mockResolvedValue(ASLEEP);
    render(<AppBar />);
    expect(await screen.findByText("9B not running")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("9B asleep")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("says the model is starting while the start request runs", async () => {
    vi.mocked(fetchModelStatus).mockResolvedValue(NOT_RUNNING);
    vi.mocked(postModelStart).mockReturnValue(new Promise(() => undefined));
    render(<AppBar />);
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    expect(await screen.findByText("9B starting")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("has no Start button when the app has no command to run", async () => {
    vi.mocked(fetchModelStatus).mockResolvedValue({ ...NOT_RUNNING, start: ASLEEP.start });
    render(<AppBar />);
    expect(await screen.findByText("9B not running")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("says why the model could not start and offers to try again", async () => {
    const start = { command: "ollama serve", isStarting: false, failure: "address already in use" };
    vi.mocked(fetchModelStatus).mockResolvedValue({ ...NOT_RUNNING, start });
    render(<AppBar />);
    expect(await screen.findByText("9B could not start")).toBeTruthy();
    expect(screen.getByText("address already in use")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("keeps the nav in a horizontally scrolling strip rather than wrapping", () => {
    render(<AppBar />);
    expect(
      screen.getByRole("navigation", { name: "Main" }).classList.contains("app-bar__nav"),
    ).toBe(true);
  });
});
