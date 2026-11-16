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

  it("keeps the default size at a 44px touch target", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).classList.contains("h-11")).toBe(true);
  });

  it("offers a neon variant as a flat high-contrast fill", () => {
    render(<Button variant="neon">Start</Button>);
    const classes = screen.getByRole("button", { name: "Start" }).classList;
    expect(classes.contains("bg-neon")).toBe(true);
    expect(classes.contains("text-background")).toBe(true);
    expect(classes.contains("shadow-glow-pink")).toBe(false);
  });

  it("offers a soft variant on the raised surface", () => {
    render(<Button variant="soft">Skip</Button>);
    expect(screen.getByRole("button", { name: "Skip" }).classList.contains("bg-surface-2")).toBe(
      true,
    );
  });
});
