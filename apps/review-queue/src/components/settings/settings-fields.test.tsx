import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenInput } from "./settings-fields";

describe("TokenInput", () => {
  it("keeps the global keyboard focus outline on the text field", () => {
    render(
      <TokenInput
        id="repos"
        describedBy="repos-hint"
        values={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox").classList.contains("outline-none")).toBe(false);
  });
});
