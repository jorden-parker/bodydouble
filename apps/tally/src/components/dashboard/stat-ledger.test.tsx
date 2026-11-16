import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeSummary } from "@/test/fake-api";
import { StatLedger } from "./stat-ledger";

function figure(label: string): HTMLElement {
  return screen.getByText(label, { selector: "span" }).closest("div") as HTMLElement;
}

describe("StatLedger", () => {
  it("leads with the reviewed count and a comparison", () => {
    render(<StatLedger summary={makeSummary()} />);

    expect(
      within(screen.getByRole("region", { name: "This period" })).getByText("7"),
    ).toBeDefined();
    expect(screen.getByText("3 more than this point last week")).toBeDefined();
    expect(screen.getByText("PRs reviewed", { selector: "span" })).toBeDefined();
  });

  it("shows each period figure with its comparison", () => {
    render(<StatLedger summary={makeSummary({ range: "day" })} />);

    expect(within(figure("PRs created")).getByText("3")).toBeDefined();
    expect(within(figure("PRs created")).getByText("same as yesterday")).toBeDefined();
    expect(within(figure("PRs merged")).getByText("2 more than yesterday")).toBeDefined();
    expect(within(figure("Tickets completed")).getByText("1 fewer than yesterday")).toBeDefined();
  });

  it("no longer shows the point-in-time figures", () => {
    render(<StatLedger summary={makeSummary()} />);

    expect(screen.queryByText("Right now")).toBeNull();
    expect(screen.queryByText("Tickets in progress")).toBeNull();
  });
});
