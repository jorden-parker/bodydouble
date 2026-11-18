import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BotFilterMenu, botsShownBy, parseBotFilter } from "./bot-filter";

function linkNamed(name: string) {
  return within(screen.getByRole("navigation", { name: "Filter by bot" })).getByRole("link", {
    name,
  });
}

describe("parseBotFilter", () => {
  it("reads the three bot filters from the URL", () => {
    expect(parseBotFilter("dependabot")).toBe("dependabot");
    expect(parseBotFilter("smartling")).toBe("smartling");
    expect(parseBotFilter("both")).toBe("both");
  });

  it("treats anything else as no filter", () => {
    expect(parseBotFilter(undefined)).toBeNull();
    expect(parseBotFilter("bogus")).toBeNull();
    expect(parseBotFilter(["dependabot", "smartling"])).toBeNull();
  });
});

describe("botsShownBy", () => {
  it("names the one bot a filter narrows to, and both bots otherwise", () => {
    expect(botsShownBy("dependabot")).toEqual(["dependabot"]);
    expect(botsShownBy("smartling")).toEqual(["smartling"]);
    expect(botsShownBy("both")).toEqual(["dependabot", "smartling"]);
    expect(botsShownBy(null)).toEqual(["dependabot", "smartling"]);
  });
});

describe("BotFilterMenu", () => {
  it("shows Everything on the trigger when no bot filter is chosen", () => {
    render(<BotFilterMenu chosen={null} query={{}} />);
    expect(screen.getByRole("button", { name: "Show: Everything" })).toBeTruthy();
  });

  it("offers everything, each bot and both bots, in that order", async () => {
    render(<BotFilterMenu chosen={null} query={{}} />);
    await userEvent.click(screen.getByRole("button", { name: "Show: Everything" }));
    expect(
      within(screen.getByRole("navigation", { name: "Filter by bot" }))
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Everything", "Dependabot", "Smartling", "Dependabot and Smartling"]);
  });

  it("keeps the repository and the sort in its links", async () => {
    render(
      <BotFilterMenu
        chosen="dependabot"
        query={{ repository: "acme/app", sort: "updated", bots: "dependabot" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show: Dependabot" }));
    expect(linkNamed("Smartling").getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=updated&bots=smartling",
    );
    expect(linkNamed("Dependabot and Smartling").getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=updated&bots=both",
    );
    expect(linkNamed("Everything").getAttribute("href")).toBe(
      "/?repository=acme%2Fapp&sort=updated",
    );
  });

  it("marks only the chosen filter with aria-current", async () => {
    render(<BotFilterMenu chosen="smartling" query={{ bots: "smartling" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Show: Smartling" }));
    expect(linkNamed("Smartling").getAttribute("aria-current")).toBe("true");
    expect(linkNamed("Everything").getAttribute("aria-current")).toBeNull();
  });
});
