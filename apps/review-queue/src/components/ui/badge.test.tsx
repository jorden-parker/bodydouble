import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("is a small 6px-radius label, not a pill", () => {
    render(<Badge>New</Badge>);
    const classes = screen.getByText("New").classList;
    expect(classes.contains("rounded-sm")).toBe(true);
    expect(classes.contains("rounded-full")).toBe(false);
  });

  it("offers tinted status chips with ink text", () => {
    render(<Badge variant="blue">Waiting</Badge>);
    const classes = screen.getByText("Waiting").classList;
    expect(classes.contains("bg-tint-blue")).toBe(true);
    expect(classes.contains("text-ink-blue")).toBe(true);
  });

  it("wraps long labels instead of overflowing a narrow row", () => {
    render(<Badge>bump typescript from 5.0.0 to 5.1.0</Badge>);
    const classes = screen.getByText("bump typescript from 5.0.0 to 5.1.0").classList;
    expect(classes.contains("whitespace-normal")).toBe(true);
    expect(classes.contains("max-w-full")).toBe(true);
  });
});
