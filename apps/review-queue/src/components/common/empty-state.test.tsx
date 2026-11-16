import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("draws a bordered card with generous padding", () => {
    render(<EmptyState emoji="🌴">Nothing here.</EmptyState>);
    const card = screen.getByText("Nothing here.").parentElement as HTMLElement;
    expect(card.classList.contains("border-line-soft")).toBe(true);
    expect(card.classList.contains("p-8")).toBe(true);
  });

  it("centres the muted message", () => {
    render(<EmptyState emoji="🌴">Nothing here.</EmptyState>);
    const card = screen.getByText("Nothing here.").parentElement as HTMLElement;
    expect(card.classList.contains("text-center")).toBe(true);
    expect(card.classList.contains("text-fg-muted")).toBe(true);
  });
});
