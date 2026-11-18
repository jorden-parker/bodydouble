import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SortMenu } from "./sort-menu";

async function openMenu(trigger: string) {
  await userEvent.click(screen.getByRole("button", { name: trigger }));
}

function linkNamed(name: string) {
  return within(screen.getByRole("navigation", { name: "Sort pull requests" })).getByRole("link", {
    name,
  });
}

describe("SortMenu", () => {
  it("opens a labelled nav with the five sorts in order", async () => {
    render(<SortMenu sort="recommended" repository={undefined} hasEntriesToOrder />);
    await openMenu("Sort: Recommended");
    const navigation = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(navigation)
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

  it("shows the chosen sort on the trigger", () => {
    render(<SortMenu sort="updated" repository={undefined} hasEntriesToOrder />);
    expect(screen.getByRole("button", { name: "Sort: Recently updated" })).toBeTruthy();
  });

  it("links Recently updated to ?sort=updated, keeping the repository", async () => {
    render(<SortMenu sort="recommended" repository="acme/app" hasEntriesToOrder />);
    await openMenu("Sort: Recommended");
    expect(linkNamed("Recently updated").getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=updated",
    );
  });

  it("links Recently updated to /?sort=updated without a repository", async () => {
    render(<SortMenu sort="recommended" repository={undefined} hasEntriesToOrder />);
    await openMenu("Sort: Recommended");
    expect(linkNamed("Recently updated").getAttribute("href")).toBe("/?sort=updated");
    expect(linkNamed("Recommended").getAttribute("href")).toBe("/");
  });

  it("marks only the chosen sort with aria-current", async () => {
    render(<SortMenu sort="updated" repository={undefined} hasEntriesToOrder />);
    await openMenu("Sort: Recently updated");
    expect(linkNamed("Recently updated").getAttribute("aria-current")).toBe("true");
    expect(linkNamed("Recommended").getAttribute("aria-current")).toBeNull();
    expect(linkNamed("Oldest first").getAttribute("aria-current")).toBeNull();
  });

  it("renders nothing when there is nothing to order and the sort is Recommended", () => {
    render(<SortMenu sort="recommended" repository={undefined} hasEntriesToOrder={false} />);
    expect(screen.queryByRole("button", { name: /^Sort:/ })).toBeNull();
  });

  it("still renders when there is nothing to order but the sort is not Recommended", () => {
    render(<SortMenu sort="oldest" repository={undefined} hasEntriesToOrder={false} />);
    expect(screen.getByRole("button", { name: "Sort: Oldest first" })).toBeTruthy();
  });
});
