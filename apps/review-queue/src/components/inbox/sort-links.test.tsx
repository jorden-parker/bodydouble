import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SortLinks } from "./sort-links";

function linkNamed(name: string) {
  return within(screen.getByRole("navigation", { name: "Sort pull requests" })).getByRole("link", {
    name,
  });
}

describe("SortLinks", () => {
  it("renders a labelled nav with the five sorts in order", () => {
    render(<SortLinks sort="recommended" repository={undefined} hasEntriesToOrder />);
    const nav = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Recommended",
      "Oldest first",
      "Newest first",
      "Smallest first",
      "Recently updated",
    ]);
  });

  it("links Recently updated to ?sort=updated, keeping the repository", () => {
    render(<SortLinks sort="recommended" repository="acme/app" hasEntriesToOrder />);
    expect(linkNamed("Recently updated").getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=updated",
    );
  });

  it("links Recently updated to /?sort=updated without a repository", () => {
    render(<SortLinks sort="recommended" repository={undefined} hasEntriesToOrder />);
    expect(linkNamed("Recently updated").getAttribute("href")).toBe("/?sort=updated");
    expect(linkNamed("Recommended").getAttribute("href")).toBe("/");
  });

  it("marks only the chosen sort with aria-current", () => {
    render(<SortLinks sort="updated" repository={undefined} hasEntriesToOrder />);
    expect(linkNamed("Recently updated").getAttribute("aria-current")).toBe("true");
    expect(linkNamed("Recommended").getAttribute("aria-current")).toBeNull();
    expect(linkNamed("Oldest first").getAttribute("aria-current")).toBeNull();
  });

  it("renders nothing when there is nothing to order and the sort is Recommended", () => {
    render(<SortLinks sort="recommended" repository={undefined} hasEntriesToOrder={false} />);
    expect(screen.queryByRole("navigation", { name: "Sort pull requests" })).toBeNull();
  });

  it("still renders when there is nothing to order but the sort is not Recommended", () => {
    render(<SortLinks sort="oldest" repository={undefined} hasEntriesToOrder={false} />);
    expect(screen.getByRole("navigation", { name: "Sort pull requests" })).toBeTruthy();
  });
});
