import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stream } from "./stream";

const steps = [{ label: "Tickets" }, { label: "Reviews" }, { label: "Settings" }];

function progressbar() {
  return screen.getByRole("progressbar", { name: "Screen progress" });
}

describe("Stream", () => {
  it("reports its position as a progress bar", () => {
    render(<Stream steps={steps} current={1} label="Screen progress" />);

    const bar = progressbar();
    expect(bar.getAttribute("aria-valuemin")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuetext")).toBe("Reviews");
  });

  it("places the rider at the current step's share of the way along", () => {
    render(<Stream steps={steps} current={1} label="Screen progress" />);

    expect(progressbar().style.getPropertyValue("--progress")).toBe("50%");
  });

  it("starts at zero and finishes at one hundred percent", () => {
    const { rerender } = render(<Stream steps={steps} current={0} label="Screen progress" />);
    expect(progressbar().style.getPropertyValue("--progress")).toBe("0%");

    rerender(<Stream steps={steps} current={2} label="Screen progress" />);
    expect(progressbar().style.getPropertyValue("--progress")).toBe("100%");
  });

  it("clamps a current index outside the steps", () => {
    render(<Stream steps={steps} current={9} label="Screen progress" />);

    expect(progressbar().getAttribute("aria-valuenow")).toBe("3");
    expect(progressbar().getAttribute("aria-valuetext")).toBe("Settings");
  });

  it("marks finished, current and upcoming stops", () => {
    const { container } = render(<Stream steps={steps} current={1} label="Screen progress" />);

    const stops = [...container.querySelectorAll(".stream__stop")];
    expect(stops.map((stop) => stop.className)).toEqual([
      "stream__stop is-done",
      "stream__stop is-current",
      "stream__stop",
    ]);
  });

  it("shows every label in the labels variant", () => {
    render(<Stream steps={steps} current={0} variant="labels" label="Screen progress" />);

    expect(screen.getByText("Reviews")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("uses the small layout in the small variant", () => {
    const { container } = render(
      <Stream steps={steps} current={0} variant="small" label="Screen progress" />,
    );

    expect(container.querySelector(".stream")?.classList.contains("stream--small")).toBe(true);
  });

  it("uses the labels layout by default", () => {
    const { container } = render(<Stream steps={steps} current={0} label="Screen progress" />);

    expect(container.querySelector(".stream")?.classList.contains("stream--labels")).toBe(true);
  });

  it("carries the tally mark as its rider", () => {
    const { container } = render(<Stream steps={steps} current={0} label="Screen progress" />);

    const rider = container.querySelector(".stream__rider");
    expect(rider?.querySelector("svg.tally-mark")).not.toBeNull();
    expect(rider?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders nothing without steps", () => {
    const { container } = render(<Stream steps={[]} current={0} label="Screen progress" />);

    expect(container.innerHTML).toBe("");
  });

  it("keeps a single step at the start", () => {
    render(<Stream steps={[{ label: "Only" }]} current={0} label="Screen progress" />);

    expect(progressbar().style.getPropertyValue("--progress")).toBe("0%");
  });
});
