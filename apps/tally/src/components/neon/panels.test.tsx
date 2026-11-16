import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Panel, Panels } from "./panels";

function overflowing(isOverflowing: boolean) {
  const sizes = isOverflowing ? { scroll: 900, client: 300 } : { scroll: 300, client: 300 };
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(sizes.scroll);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(sizes.client);
}

function renderPanels() {
  return render(
    <Panels>
      <Panel title="Tickets">
        <p>ticket list</p>
      </Panel>
      <Panel title="Work Log">
        <p>work list</p>
      </Panel>
      <Panel title="Totals">
        <p>totals</p>
      </Panel>
    </Panels>,
  );
}

function rootOf(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".panels");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Panels", () => {
  it("shows every panel side by side when they fit", () => {
    overflowing(false);
    const { container } = renderPanels();

    expect(rootOf(container)?.dataset.mode).toBe("spread");
    expect(container.querySelectorAll(".panel.is-current")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Tickets" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Totals" })).toBeDefined();
    expect(container.querySelector(".panels__pager")).not.toBeNull();
  });

  it("pages through panels with a progress pager when they do not fit", () => {
    overflowing(true);
    const { container } = renderPanels();

    expect(rootOf(container)?.dataset.mode).toBe("paged");
    const currentPanel = container.querySelector(".panel.is-current");
    expect(currentPanel?.textContent).toBe("ticket list");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
  });

  it("moves to the next and previous panel from the pager", () => {
    overflowing(true);
    const { container } = renderPanels();

    fireEvent.click(screen.getByRole("button", { name: "Next section" }));
    expect(container.querySelector(".panel.is-current")?.textContent).toBe("work list");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByText("2/3 · Work Log")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Previous section" }));
    expect(container.querySelector(".panel.is-current")?.textContent).toBe("ticket list");
  });

  it("disables the pager buttons at either end without dropping keyboard focus", () => {
    overflowing(true);
    renderPanels();

    const previous = screen.getByRole("button", { name: "Previous section" });
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(previous.hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Next section" }));
    fireEvent.click(screen.getByRole("button", { name: "Next section" }));
    const next = screen.getByRole("button", { name: "Next section" });
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(next.hasAttribute("disabled")).toBe(false);
  });

  it("goes back to spread once the panels fit again", () => {
    overflowing(true);
    const { container, rerender } = renderPanels();
    expect(rootOf(container)?.dataset.mode).toBe("paged");

    overflowing(false);
    rerender(
      <Panels>
        <Panel title="Tickets">
          <p>ticket list</p>
        </Panel>
        <Panel title="Work Log">
          <p>work list</p>
        </Panel>
      </Panels>,
    );
    expect(rootOf(container)?.dataset.mode).toBe("spread");
  });

  it("omits the pager for a single panel", () => {
    overflowing(true);
    const { container } = render(
      <Panels>
        <Panel title="Only">
          <p>alone</p>
        </Panel>
      </Panels>,
    );

    expect(container.querySelector(".panels__pager")).toBeNull();
    expect(rootOf(container)?.dataset.mode).toBe("spread");
  });

  it("ignores empty children", () => {
    overflowing(false);
    const { container } = render(
      <Panels>
        {null}
        <Panel title="Only">
          <p>alone</p>
        </Panel>
        {false}
      </Panels>,
    );

    expect(container.querySelectorAll(".panel")).toHaveLength(1);
  });

  it("pages when one panel's own content overflows while the body still fits", () => {
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(300);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
      return this.getAttribute("aria-label") === "Work Log" ? 900 : 300;
    });
    const { container } = renderPanels();

    expect(rootOf(container)?.dataset.mode).toBe("paged");
  });

  it("re-measures when the layout box resizes", () => {
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    overflowing(true);
    const { container, unmount } = renderPanels();
    expect(rootOf(container)?.dataset.mode).toBe("paged");

    overflowing(false);
    observers.forEach((callback) => callback());
    expect(rootOf(container)?.dataset.mode).toBe("spread");
    unmount();
    vi.unstubAllGlobals();
  });
});
