import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Otter } from "./otter";

describe("Otter", () => {
  it("renders the otter emoji", () => {
    render(<Otter />);
    expect(screen.getByText("🦦")).toBeTruthy();
  });

  it("is hidden from assistive technology", () => {
    render(<Otter />);
    expect(screen.getByText("🦦").getAttribute("aria-hidden")).toBe("true");
  });

  it("wiggles on hover", () => {
    render(<Otter />);
    expect(screen.getByText("🦦").classList.contains("hover:animate-wiggle")).toBe(true);
  });

  it("uses the medium size by default", () => {
    render(<Otter />);
    expect(screen.getByText("🦦").classList.contains("text-4xl")).toBe(true);
  });

  it("sizes the emoji for the small and large variants", () => {
    const { rerender } = render(<Otter size="small" />);
    expect(screen.getByText("🦦").classList.contains("text-2xl")).toBe(true);
    rerender(<Otter size="large" />);
    expect(screen.getByText("🦦").classList.contains("text-6xl")).toBe(true);
  });

  it("floats only when asked to", () => {
    const { rerender } = render(<Otter />);
    expect(screen.getByText("🦦").classList.contains("animate-float")).toBe(false);
    rerender(<Otter isFloating />);
    expect(screen.getByText("🦦").classList.contains("animate-float")).toBe(true);
  });
});
