import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("deepens the solid default fill on hover", () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole("button", { name: "Save" }).classList;
    expect(classes.contains("hover:bg-primary/90")).toBe(true);
    expect(classes.contains("hover:bg-primary/80")).toBe(false);
  });

  it("presses with the calm easing and a subtle scale", () => {
    render(<Button>Save</Button>);
    const classes = screen.getByRole("button", { name: "Save" }).classList;
    expect(classes.contains("ease-calm")).toBe(true);
    expect(classes.contains("active:not-aria-[haspopup]:scale-[0.98]")).toBe(true);
    expect(classes.contains("ease-spring")).toBe(false);
  });

  it("sets the default control at 40px and the small control at 32px", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).classList.contains("h-10")).toBe(true);
    render(<Button size="sm">Skip</Button>);
    expect(screen.getByRole("button", { name: "Skip" }).classList.contains("h-8")).toBe(true);
  });

  it("uses the solid primary fill for the main action", () => {
    render(<Button>Start</Button>);
    const classes = screen.getByRole("button", { name: "Start" }).classList;
    expect(classes.contains("bg-primary")).toBe(true);
    expect(classes.contains("text-primary-foreground")).toBe(true);
  });

  it("keeps the neon variant as the same solid primary fill", () => {
    render(<Button variant="neon">Start</Button>);
    const classes = screen.getByRole("button", { name: "Start" }).classList;
    expect(classes.contains("bg-primary")).toBe(true);
    expect(classes.contains("shadow-glow-pink")).toBe(false);
  });

  it("offers a soft variant on the surface with a hairline border", () => {
    render(<Button variant="soft">Skip</Button>);
    const classes = screen.getByRole("button", { name: "Skip" }).classList;
    expect(classes.contains("bg-surface")).toBe(true);
    expect(classes.contains("border-line")).toBe(true);
  });
});
