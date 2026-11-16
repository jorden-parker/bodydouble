import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FocusTimer } from "./focus-timer";

describe("FocusTimer", () => {
  it("names the timer with its time left and says when it runs", async () => {
    render(
      <TooltipProvider>
        <FocusTimer onFinished={vi.fn()} />
      </TooltipProvider>,
    );

    const timer = screen.getByRole("button", { name: "Focus timer, 25:00 left" });
    expect(timer.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(timer);
    expect(timer.getAttribute("aria-pressed")).toBe("true");
  });
});
