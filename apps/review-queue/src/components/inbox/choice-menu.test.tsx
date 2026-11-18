import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChoiceMenu } from "./choice-menu";

const CHOICES = [
  { label: "Recommended", href: "/", isChosen: false },
  { label: "Oldest first", href: "/?sort=oldest", isChosen: true },
  { label: "Newest first", href: "/?sort=newest", isChosen: false },
];

function renderMenu() {
  render(<ChoiceMenu title="Sort" label="Sort pull requests" choices={CHOICES} />);
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Sort: Oldest first" }));
}

describe("ChoiceMenu", () => {
  it("shows the chosen label on the trigger and no links while closed", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Sort: Oldest first" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Sort pull requests" })).toBeNull();
  });

  it("opens a navigation with one link per choice, in order, with their hrefs", async () => {
    renderMenu();
    await openMenu();
    const navigation = screen.getByRole("navigation", { name: "Sort pull requests" });
    const links = within(navigation).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Recommended",
      "Oldest first",
      "Newest first",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/?sort=oldest",
      "/?sort=newest",
    ]);
  });

  it("marks only the chosen link with aria-current", async () => {
    renderMenu();
    await openMenu();
    const navigation = screen.getByRole("navigation", { name: "Sort pull requests" });
    expect(
      within(navigation).getByRole("link", { name: "Oldest first" }).getAttribute("aria-current"),
    ).toBe("true");
    expect(
      within(navigation).getByRole("link", { name: "Recommended" }).getAttribute("aria-current"),
    ).toBeNull();
    expect(
      within(navigation).getByRole("link", { name: "Newest first" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("closes the menu when a link is chosen", async () => {
    renderMenu();
    await openMenu();
    await userEvent.click(screen.getByRole("link", { name: "Newest first" }));
    expect(screen.queryByRole("link")).toBeNull();
  });
});
