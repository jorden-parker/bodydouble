import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQueueKeys } from "./use-queue-keys";

const onSnooze = vi.fn();
const onRefresh = vi.fn();

function Harness() {
  const container = useRef<HTMLDivElement>(null);
  useQueueKeys(container);
  return (
    <div ref={container}>
      <button data-queue-refresh onClick={onRefresh}>
        Refresh
      </button>
      <input aria-label="Filter" />
      <ul>
        <li data-queue-row>
          <a href="#one" data-queue-open>
            one
          </a>
          <button data-queue-action="snooze" onClick={() => onSnooze("one")}>
            snooze one
          </button>
        </li>
        <li data-queue-row>
          <a href="#two" data-queue-open>
            two
          </a>
          <button data-queue-action="snooze" onClick={() => onSnooze("two")}>
            snooze two
          </button>
        </li>
      </ul>
      <details>
        <summary>Later</summary>
        <ul>
          <li data-queue-row>
            <a href="#hidden" data-queue-open>
              hidden
            </a>
          </li>
        </ul>
      </details>
    </div>
  );
}

function press(key: string, options: KeyboardEventInit = {}, target: Element = document.body) {
  fireEvent.keyDown(target, { key, ...options });
}

describe("useQueueKeys", () => {
  beforeEach(() => {
    onSnooze.mockReset();
    onRefresh.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("moves focus down and up through the visible rows with j and k", () => {
    render(<Harness />);
    press("j");
    expect(document.activeElement?.textContent).toBe("one");
    press("j");
    expect(document.activeElement?.textContent).toBe("two");
    press("k");
    expect(document.activeElement?.textContent).toBe("one");
  });

  it("does not move into a row inside a closed fold", () => {
    render(<Harness />);
    press("j");
    press("j");
    press("j");
    expect(document.activeElement?.textContent).toBe("two");
  });

  it("clicks the snooze control of the focused row with s", () => {
    render(<Harness />);
    press("j");
    press("j");
    press("s");
    expect(onSnooze).toHaveBeenCalledWith("two");
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });

  it("clicks Refresh with r", () => {
    render(<Harness />);
    press("r");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("ignores keys while typing or with a modifier held", () => {
    render(<Harness />);
    press("j", {}, screen.getByLabelText("Filter"));
    expect(document.activeElement?.textContent).not.toBe("one");
    press("r", { metaKey: true });
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
