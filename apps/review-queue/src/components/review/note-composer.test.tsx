import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteComposer } from "./note-composer";

describe("NoteComposer", () => {
  it("labels the note field and marks the chosen kind", () => {
    render(<NoteComposer onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: "Note text" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Question" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});
