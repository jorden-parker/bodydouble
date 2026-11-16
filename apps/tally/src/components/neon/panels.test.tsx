import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./panels";

describe("Panel", () => {
  it("is a labelled region holding its content", () => {
    render(
      <Panel title="Tickets">
        <p>ticket list</p>
      </Panel>,
    );

    const region = screen.getByRole("region", { name: "Tickets" });
    expect(region.textContent).toBe("ticket list");
  });

  it("is a bordered card that scrolls with the page, never paged", () => {
    const { container } = render(
      <Panel title="Notices">
        <p>first</p>
      </Panel>,
    );

    const region = screen.getByRole("region", { name: "Notices" });
    expect(region.className).toContain("rounded-xl");
    expect(region.className).toContain("border-line-soft");
    expect(container.querySelector(".panels__pager")).toBeNull();
  });
});
