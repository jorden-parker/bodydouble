import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("draws a 1px soft border on a 12px radius", () => {
    const { container } = render(<Card>Body</Card>);
    const classes = (container.firstElementChild as HTMLElement).classList;
    expect(classes.contains("border-line-soft")).toBe(true);
    expect(classes.contains("rounded-xl")).toBe(true);
  });

  it("is flat, with no shadow or ring", () => {
    const { container } = render(<Card>Body</Card>);
    const classes = (container.firstElementChild as HTMLElement).classList;
    expect(classes.contains("shadow-lift")).toBe(false);
    expect(classes.contains("ring-1")).toBe(false);
  });

  it("pads 16px on phones and 24px from 640px", () => {
    const { container } = render(<Card>Body</Card>);
    const classes = (container.firstElementChild as HTMLElement).classList;
    expect(classes.contains("p-4")).toBe(true);
    expect(classes.contains("sm:p-6")).toBe(true);
  });
});
