import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildHref, ChoiceLinks } from "./choice-links";

describe("buildHref", () => {
  it("adds only the query values that are set", () => {
    expect(buildHref("/dependabot", { repository: "acme/app", sort: undefined })).toBe(
      "/dependabot?repository=acme%2Fapp",
    );
  });

  it("returns the bare path when no value is set", () => {
    expect(buildHref("/", { repository: undefined, sort: undefined })).toBe("/");
  });
});

describe("ChoiceLinks", () => {
  it("renders a labelled nav with one link per choice and marks the chosen one", () => {
    render(
      <ChoiceLinks
        label="Sort pull requests"
        choices={[
          { label: "Recommended", href: "/", isChosen: false },
          { label: "Oldest first", href: "/?sort=oldest", isChosen: true },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(nav).getByRole("link", { name: "Oldest first" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      within(nav).getByRole("link", { name: "Recommended" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
