import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/dashboard", () => ({
  Dashboard: () => <p>dashboard</p>,
}));
vi.mock("@/components/work/work-log", () => ({
  WorkLog: () => <p>work log</p>,
}));
vi.mock("@/components/tickets/assigned-tickets", () => ({
  AssignedTickets: () => <p>tickets</p>,
}));
vi.mock("@/components/settings/settings-form", () => ({
  SettingsForm: () => <p>settings form</p>,
}));

import DashboardPage from "./page";
import SettingsPage, { metadata as settingsMetadata } from "./settings/page";
import { metadata as ticketsMetadata } from "./tickets/page";
import { metadata as workMetadata } from "./work/page";
import WorkPage from "./work/page";

describe("pages", () => {
  it("render the dashboard at the root", () => {
    render(<DashboardPage />);

    expect(screen.getByText("dashboard")).toBeDefined();
  });

  it("render the work log", () => {
    render(<WorkPage />);

    expect(screen.getByText("work log")).toBeDefined();
  });

  it("render the settings form", () => {
    render(<SettingsPage />);

    expect(screen.getByText("settings form")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeDefined();
    expect(screen.getByText("Choose what Tally counts and how it reads your week.")).toBeDefined();
  });

  it("give each page its own document title", () => {
    expect([ticketsMetadata.title, workMetadata.title, settingsMetadata.title]).toEqual([
      "Tickets · Tally",
      "Work log · Tally",
      "Settings · Tally",
    ]);
  });
});
