import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Panel, Panels } from "./panels";

let contentHeight = 300;
let resizeCallback: ResizeObserverCallback | undefined;

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPanels() {
  return render(
    <Panels label="Review sections">
      <Panel title="Pick Up">
        <p>First body</p>
      </Panel>
      <Panel title="Waiting">
        <p>Second body</p>
      </Panel>
    </Panels>,
  );
}

function rootMode(container: HTMLElement): string | null {
  return container.querySelector("[data-mode]")?.getAttribute("data-mode") ?? null;
}

describe("Panels", () => {
  beforeEach(() => {
    contentHeight = 300;
    resizeCallback = undefined;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(() => contentHeight);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => 500);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the panels inside the main landmark the skip link targets", () => {
    renderPanels();
    const main = screen.getByRole("main");
    expect(main.id).toBe("main");
    expect(main.contains(screen.getByText("Second body"))).toBe(true);
  });

  it("passes a layout class to the main area so screens can size their columns", () => {
    render(
      <Panels label="Review sections" className="inbox-columns">
        <Panel title="Only">
          <p>Body</p>
        </Panel>
      </Panels>,
    );
    expect(screen.getByRole("main").classList.contains("inbox-columns")).toBe(true);
  });

  it("shows the panels side by side when they fit", () => {
    const { container } = renderPanels();
    expect(rootMode(container)).toBe("spread");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("pages through the panels with a stream pager when they overflow", () => {
    contentHeight = 900;
    const { container } = renderPanels();
    expect(rootMode(container)).toBe("paged");
    const progressBar = screen.getByRole("progressbar", { name: "Review sections" });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("1");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("2");
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Pick Up");
    expect(screen.getByText("1/2 · Pick Up")).toBeTruthy();
  });

  it("moves to the next panel with the pager buttons and disables the ends", () => {
    contentHeight = 900;
    renderPanels();
    const previous = screen.getByRole("button", { name: "Previous section" });
    const next = screen.getByRole("button", { name: "Next section" });
    expect(previous.hasAttribute("disabled")).toBe(true);

    fireEvent.click(next);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Waiting");
    expect(previous.hasAttribute("disabled")).toBe(false);
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  it("re-measures when the window resizes", () => {
    const { container } = renderPanels();
    expect(rootMode(container)).toBe("spread");

    contentHeight = 900;
    act(() => resizeCallback?.([], {} as ResizeObserver));

    expect(rootMode(container)).toBe("paged");
  });

  it("lets a single panel that overflows fill the area without a pager", () => {
    contentHeight = 900;
    const { container } = render(
      <Panels label="Review sections">
        <Panel title="Only">
          <p>Lonely body</p>
        </Panel>
      </Panels>,
    );
    expect(rootMode(container)).toBe("paged");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
