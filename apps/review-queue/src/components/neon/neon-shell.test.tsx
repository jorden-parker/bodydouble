import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NeonShell } from "./neon-shell";

const pathnameState = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathnameState.current }));

describe("NeonShell", () => {
  beforeEach(() => {
    pathnameState.current = "/";
  });

  it("puts the app bar above the page content", () => {
    render(
      <NeonShell>
        <p>Page body</p>
      </NeonShell>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByText("Page body")).toBeTruthy();
  });

  it("wraps the app bar and the page in the app frame", () => {
    const { container } = render(
      <NeonShell>
        <p>Page body</p>
      </NeonShell>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.classList.contains("app")).toBe(true);
    expect(shell.classList.contains("app--workspace")).toBe(false);
    expect(shell.querySelector(".app-body")?.contains(screen.getByText("Page body"))).toBe(true);
  });

  it("leaves out the global app bar on PR pages, which have their own top bar", () => {
    pathnameState.current = "/pr/acme/app/7";
    render(
      <NeonShell>
        <p>Workspace</p>
      </NeonShell>,
    );
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByText("Workspace")).toBeTruthy();
  });

  it("gives the PR workspace a full-viewport shell so its own regions can scroll", () => {
    pathnameState.current = "/pr/acme/app/7";
    const { container } = render(
      <NeonShell>
        <p>Workspace</p>
      </NeonShell>,
    );
    expect((container.firstElementChild as HTMLElement).classList.contains("app--workspace")).toBe(
      true,
    );
  });
});
