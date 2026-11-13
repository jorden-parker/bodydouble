import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TallyMark } from "./tally-mark";

describe("TallyMark", () => {
  it("is decorative and hidden from assistive tech", () => {
    const { container } = render(<TallyMark />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.classList.contains("tally-mark")).toBe(true);
  });

  it("sizes by variant", () => {
    const { container } = render(<TallyMark size="large" />);

    expect(container.querySelector("svg")?.getAttribute("width")).toBe("48");
  });

  it("defaults to the medium size", () => {
    const { container } = render(<TallyMark />);

    expect(container.querySelector("svg")?.getAttribute("width")).toBe("36");
  });

  it("gives each instance its own gradient so several can share a page", () => {
    const { container } = render(
      <>
        <TallyMark />
        <TallyMark />
      </>,
    );

    const gradientIds = [...container.querySelectorAll("linearGradient")].map((gradient) =>
      gradient.getAttribute("id"),
    );
    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
    const strokes = [...container.querySelectorAll("g")].map((group) =>
      group.getAttribute("stroke"),
    );
    expect(strokes).toEqual(gradientIds.map((gradientId) => `url(#${gradientId})`));
  });
});
