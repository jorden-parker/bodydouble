import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NeonShell } from "./neon-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("NeonShell", () => {
  it("puts the app bar above the page content", () => {
    render(
      <NeonShell>
        <p>Page body</p>
      </NeonShell>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByText("Page body")).toBeTruthy();
  });

  it("wraps the app bar and the page in the full-height app frame", () => {
    const { container } = render(
      <NeonShell>
        <p>Page body</p>
      </NeonShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.classList.contains("app")).toBe(true);
    expect(shell.querySelector(".app-body")?.contains(screen.getByText("Page body"))).toBe(true);
  });
});
