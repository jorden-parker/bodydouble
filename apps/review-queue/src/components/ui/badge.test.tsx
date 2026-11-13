import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("is fully rounded", () => {
    render(<Badge>New</Badge>);
    const classes = screen.getByText("New").classList;
    expect(classes.contains("rounded-full")).toBe(true);
    expect(classes.contains("rounded-4xl")).toBe(false);
  });

  it("offers tinted neon chips with ink text", () => {
    render(<Badge variant="blue">Waiting</Badge>);
    const classes = screen.getByText("Waiting").classList;
    expect(classes.contains("bg-tint-blue")).toBe(true);
    expect(classes.contains("text-ink-blue")).toBe(true);
  });

  it("sizes the chip to a comfortable 28px", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New").classList.contains("h-7")).toBe(true);
  });
});
