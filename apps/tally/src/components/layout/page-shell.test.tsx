import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyNote, PageBand, PageShell, ProblemAlert, SectionHeading } from "./page-shell";

describe("PageShell", () => {
  it("titles the page and shows its actions", () => {
    render(
      <PageShell
        title="Work log"
        description="Every PR"
        actions={<button type="button">Go</button>}
      >
        <p>body</p>
      </PageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Work log" })).toBeDefined();
    expect(screen.getByText("Every PR")).toBeDefined();
    expect(screen.getByRole("button", { name: "Go" })).toBeDefined();
    expect(screen.getByText("body")).toBeDefined();
    expect(screen.getByRole("main").id).toBe("main");
  });

  it("sets the title in a band above the main content", () => {
    const { container } = render(
      <PageShell title="Work log">
        <p>body</p>
      </PageShell>,
    );

    const band = container.querySelector(".page-band");
    expect(band?.querySelector("h1")?.textContent).toBe("Work log");
    expect(screen.getByRole("main").contains(band)).toBe(false);
  });

  it("accepts a title with its own styled parts", () => {
    render(
      <PageShell
        title={
          <>
            Hey There. <span data-testid="accent">Here&apos;s Your Tally.</span>
          </>
        }
      >
        <p>body</p>
      </PageShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Hey There. Here's Your Tally." }),
    ).toBeDefined();
    expect(screen.getByTestId("accent").textContent).toBe("Here's Your Tally.");
  });
});

describe("SectionHeading", () => {
  it("reads the count in brackets", () => {
    render(<SectionHeading title="Done" count={3} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Done (3)");
  });

  it("reads as a monospace eyebrow label", () => {
    render(<SectionHeading title="Done" />);

    expect(screen.getByRole("heading", { level: 2 }).className).toContain("text-eyebrow");
  });

  it("can be a third-level heading without a count", () => {
    render(<SectionHeading title="Tickets" level={3} />);

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Tickets");
  });
});

describe("PageBand", () => {
  it("narrows to the narrow column when asked", () => {
    const { container } = render(
      <PageBand narrow>
        <h1>Settings</h1>
      </PageBand>,
    );

    expect(container.querySelector(".page-band__inner--narrow h1")?.textContent).toBe("Settings");
  });
});

describe("EmptyNote", () => {
  it("shows the tally mark above a friendly line", () => {
    const { container } = render(<EmptyNote>Nothing here.</EmptyNote>);

    expect(container.querySelector("p.empty-note > svg.tally-mark")).not.toBeNull();
    expect(screen.getByText("Nothing here.")).toBeDefined();
  });
});

describe("ProblemAlert", () => {
  it("renders nothing without messages", () => {
    render(<ProblemAlert messages={[]} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists each message", () => {
    render(<ProblemAlert messages={["GitHub failed", "Shortcut failed"]} />);

    expect(screen.getByRole("alert").textContent).toBe("GitHub failedShortcut failed");
  });
});
