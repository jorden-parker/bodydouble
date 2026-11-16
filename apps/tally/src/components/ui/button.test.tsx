import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("keeps the global keyboard focus outline", () => {
    render(<Button>Save</Button>);

    const classes = screen.getByRole("button", { name: "Save" }).classList;
    expect(classes.contains("outline-none")).toBe(false);
  });
});
