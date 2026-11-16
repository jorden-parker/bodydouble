import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";
import { SelectionToolbar } from "./selection-toolbar";
import type { LineSelection } from "./use-line-selection";

const SELECTION: LineSelection = {
  range: { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 2 } },
  top: 0,
  left: 0,
};

describe("SelectionToolbar", () => {
  it("offers only Note when the model is off", () => {
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={vi.fn()}
        onAction={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Note" })).toBeTruthy();
    for (const { label } of ASSIST_ACTION_BUTTONS) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("offers no Note button when the range cannot take a note", () => {
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={null}
        onAction={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Note" })).toBeNull();
  });

  it("renders nothing when the model is off and there is no note to offer", () => {
    const { container } = render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={null}
        onAction={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("offers the quick verbs and a question box when the model is on", () => {
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled
        onNote={vi.fn()}
        onAction={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Explain/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Simplify/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Comment/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Ask about these lines" })).toBeTruthy();
  });

  it("sends the typed question for exactly these lines on Enter", () => {
    const onAsk = vi.fn();
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled
        onNote={null}
        onAction={vi.fn()}
        onAsk={onAsk}
      />,
    );
    const box = screen.getByRole("textbox", { name: "Ask about these lines" });
    fireEvent.change(box, { target: { value: "Can two refreshes run at once?" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onAsk).toHaveBeenCalledWith("Can two refreshes run at once?");
  });

  it("runs the verb a quick button names", async () => {
    const onAction = vi.fn();
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled
        onNote={null}
        onAction={onAction}
        onAsk={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /Simplify/ }));
    expect(onAction).toHaveBeenCalledWith("simplify");
  });

  it("runs onNote when Note is clicked", async () => {
    const onNote = vi.fn();
    render(
      <SelectionToolbar
        selection={SELECTION}
        aiEnabled={false}
        onNote={onNote}
        onAction={vi.fn()}
        onAsk={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Note" }));
    expect(onNote).toHaveBeenCalledOnce();
  });
});
