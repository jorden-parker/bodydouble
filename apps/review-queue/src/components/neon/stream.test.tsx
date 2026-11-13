import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stream } from "./stream";

const steps = [
  { label: "Orient" },
  { label: "Walk the Changes" },
  { label: "Conversation" },
  { label: "Submit" },
];

describe("Stream", () => {
  it("is a progressbar that names the current step", () => {
    render(<Stream steps={steps} currentIndex={1} label="Review progress" />);
    const progressBar = screen.getByRole("progressbar", { name: "Review progress" });
    expect(progressBar.getAttribute("aria-valuemin")).toBe("1");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("4");
    expect(progressBar.getAttribute("aria-valuenow")).toBe("2");
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Walk the Changes");
  });

  it("shows every step label in the labels variant", () => {
    render(<Stream steps={steps} currentIndex={0} label="Review progress" />);
    for (const step of steps) {
      expect(screen.getByText(step.label)).toBeTruthy();
    }
  });

  it("marks the steps before the current one as done and the current one as current", () => {
    const { container } = render(<Stream steps={steps} currentIndex={2} label="Review progress" />);
    const stops = [...container.querySelectorAll(".stream__stop")];
    expect(stops.map((stop) => stop.classList.contains("is-done"))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(stops.map((stop) => stop.classList.contains("is-current"))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it("moves the rider along the water to the current step", () => {
    render(<Stream steps={steps} currentIndex={1} label="Review progress" />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar.style.getPropertyValue("--progress")).toBe("33.33%");
    expect(progressBar.querySelectorAll(".stream__stop")[1].getAttribute("style")).toContain(
      "--at: 33.33%",
    );
  });

  it("puts the otter rider on the water, hidden from assistive technology", () => {
    const { container } = render(<Stream steps={steps} currentIndex={0} label="Review progress" />);
    const rider = container.querySelector(".stream__rider");
    expect(rider?.textContent).toContain("🦦");
    expect(rider?.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("drops the labels in the small variant", () => {
    const { container } = render(
      <Stream steps={steps} currentIndex={0} label="Sections" variant="small" />,
    );
    expect(container.querySelector(".stream--small")).not.toBeNull();
    expect(screen.queryByText("Orient")).toBeNull();
  });

  it("stays at the start for a single step", () => {
    render(<Stream steps={[{ label: "Only" }]} currentIndex={0} label="Review progress" />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar.style.getPropertyValue("--progress")).toBe("0%");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("1");
  });
});
