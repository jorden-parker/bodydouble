import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateBadge } from "./date-badge";

const now = Date.parse("2026-11-18T12:00:00Z");

describe("DateBadge", () => {
  it("renders the created date as a badge time element", () => {
    render(<DateBadge kind="created" iso="2026-11-15T12:00:00Z" now={now} />);
    const time = screen.getByText("created 3 d ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-11-15T12:00:00Z");
    expect(time.getAttribute("data-slot")).toBe("badge");
  });

  it("renders the updated date as a badge time element", () => {
    render(<DateBadge kind="updated" iso="2026-11-18T10:00:00Z" now={now} />);
    const time = screen.getByText("updated 2 h ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-11-18T10:00:00Z");
    expect(time.getAttribute("data-slot")).toBe("badge");
  });

  it("hides the decorative icon from assistive technology", () => {
    render(<DateBadge kind="created" iso="2026-11-15T12:00:00Z" now={now} />);
    const icon = screen.getByText("created 3 d ago").querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
