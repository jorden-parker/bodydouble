import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeApi, makeSettings } from "@/test/fake-api";
import { SettingsForm } from "./settings-form";

async function renderLoaded(overrides = {}) {
  render(<SettingsForm api={fakeApi(overrides)} />);
  await screen.findByLabelText("GitHub Orgs and Repos");
}

function chosenSources(): string[] {
  const chosenList = screen.getByRole("list", { name: "Chosen orgs and repos" });
  return within(chosenList)
    .getAllByRole("listitem")
    .map((item) => item.textContent?.replace(/^Remove.*$/, "") ?? "");
}

describe("SettingsForm", () => {
  it("shows the saved settings", async () => {
    const fetchSettings = async () =>
      makeSettings({ allowList: ["acme", "me/side"], weekStart: 0 });
    await renderLoaded({ fetchSettings });

    expect(chosenSources()).toEqual(["acme", "me/side"]);
    expect(screen.getByText("2 chosen")).toBeDefined();
    expect((screen.getByRole("radio", { name: "Sunday" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Time Zone") as HTMLInputElement).value).toBe("UTC");
  });

  it("adds sources with Enter and removes them with their chip", async () => {
    const saveSettings = vi.fn(async () => makeSettings());
    await renderLoaded({ saveSettings });

    await userEvent.type(screen.getByLabelText("GitHub Orgs and Repos"), "northwind{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Remove acme" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(saveSettings).toHaveBeenCalledWith({
      allowList: ["northwind"],
      weekStart: 1,
      timeZone: "UTC",
    });
  });

  it("adds sources from the add button too", async () => {
    await renderLoaded();

    await userEvent.type(screen.getByLabelText("GitHub Orgs and Repos"), "me/side");
    await userEvent.click(screen.getByRole("button", { name: "Add org or repo" }));

    expect(chosenSources()).toEqual(["acme", "me/side"]);
  });

  it("ignores blank and repeated sources", async () => {
    await renderLoaded();

    await userEvent.type(screen.getByLabelText("GitHub Orgs and Repos"), "   {Enter}acme{Enter}");

    expect(chosenSources()).toEqual(["acme"]);
  });

  it("adds every line of a pasted list", async () => {
    await renderLoaded();

    fireEvent.paste(screen.getByLabelText("GitHub Orgs and Repos"), {
      clipboardData: { getData: () => "me/side\nnorthwind\n" },
    });

    expect(chosenSources()).toEqual(["acme", "me/side", "northwind"]);
  });

  it("gives every settings panel a minimum width so narrow screens page them", async () => {
    await renderLoaded();

    for (const title of ["Sources", "Calendar", "What Tally Counts"]) {
      expect(screen.getByRole("region", { name: title }).className).toContain("min-w-72!");
    }
  });

  it("saves the edited values and says what to do next", async () => {
    const saveSettings = vi.fn(async () => makeSettings());
    await renderLoaded({ saveSettings });

    await userEvent.type(screen.getByLabelText("GitHub Orgs and Repos"), "me/side{Enter}");
    await userEvent.click(screen.getByRole("radio", { name: "Sunday" }));
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(saveSettings).toHaveBeenCalledWith({
      allowList: ["acme", "me/side"],
      weekStart: 0,
      timeZone: "UTC",
    });
    expect(await screen.findByText(/Saved\. Sync from the dashboard/)).toBeDefined();
  });

  it("says when edits are not saved yet", async () => {
    await renderLoaded();
    expect(screen.queryByText(/Unsaved changes/)).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "Sunday" }));

    expect(screen.getByText(/Unsaved changes/)).toBeDefined();
  });

  it("previews what Tally counts with the chosen week start and time zone", async () => {
    await renderLoaded();

    const preview = screen.getByRole("region", { name: "What Tally Counts" });
    expect(within(preview).getByText("acme")).toBeDefined();
    expect(within(preview).getByText("Weeks start Monday")).toBeDefined();
    expect(within(preview).getByText("UTC")).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: "Sunday" }));

    expect(within(preview).getByText("Weeks start Sunday")).toBeDefined();
  });

  it("describes the week start and time zone fields with their hints", async () => {
    render(<SettingsForm api={fakeApi()} />);

    const timeZone = await screen.findByLabelText("Time Zone");
    expect(timeZone.getAttribute("name")).toBe("timeZone");
    expect(timeZone.getAttribute("autocomplete")).toBe("off");
    expect(timeZone.getAttribute("spellcheck")).toBe("false");
    expect(timeZone.getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(timeZone.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe("Decides which day a review or ticket counts toward.");
    const weekStart = screen.getByRole("radiogroup", { name: "Week Starts On" });
    expect(
      document.getElementById(weekStart.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe("Your weekly counts begin on this day.");
  });

  it("says what happens with no sources", async () => {
    await renderLoaded({ fetchSettings: async () => makeSettings({ allowList: [] }) });

    const preview = screen.getByRole("region", { name: "What Tally Counts" });
    expect(within(preview).getByText(/Tally counts nothing/)).toBeDefined();
  });

  it("shows why saving failed", async () => {
    const saveSettings = async () => {
      throw new Error("allowList: Invalid string");
    };
    await renderLoaded({ saveSettings });

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("allowList: Invalid string"),
    );
  });

  it("shows why loading failed", async () => {
    const fetchSettings = async () => {
      throw new Error("database is locked");
    };
    render(<SettingsForm api={fakeApi({ fetchSettings })} />);

    expect((await screen.findByRole("alert")).textContent).toContain("database is locked");
  });
});
