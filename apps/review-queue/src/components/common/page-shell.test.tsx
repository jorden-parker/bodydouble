import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, PageShell } from "./page-shell";

describe("PageShell", () => {
  it("renders its children inside a main landmark", () => {
    render(
      <PageShell>
        <p>Body content</p>
      </PageShell>,
    );
    const main = screen.getByRole("main");
    expect(main.contains(screen.getByText("Body content"))).toBe(true);
  });

  it("is a normal scrolling page container, not a fixed-height pane", () => {
    render(
      <PageShell>
        <p>Body content</p>
      </PageShell>,
    );
    const classes = screen.getByRole("main").classList;
    expect(classes.contains("page-shell")).toBe(true);
    expect(classes.contains("page-shell--narrow")).toBe(false);
    expect(classes.contains("overflow-y-auto")).toBe(false);
  });

  it("uses the narrow form column when asked", () => {
    render(
      <PageShell isNarrow>
        <p>Body content</p>
      </PageShell>,
    );
    expect(screen.getByRole("main").classList.contains("page-shell--narrow")).toBe(true);
  });

  it("gives the main landmark the id the skip link targets", () => {
    render(
      <PageShell>
        <p>Body content</p>
      </PageShell>,
    );
    expect(screen.getByRole("main").id).toBe("main");
  });
});

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Settings" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings");
  });

  it("renders the lede when given", () => {
    render(<PageHeader title="Settings" lede="Saved here." />);
    expect(screen.getByText("Saved here.").tagName).toBe("P");
  });

  it("renders the action node when given", () => {
    render(<PageHeader title="Settings" action={<button type="button">Reset</button>} />);
    expect(screen.getByRole("button", { name: "Reset" }).tagName).toBe("BUTTON");
  });

  it("renders a back link with its label and href when asked", () => {
    render(<PageHeader title="Settings" backHref="/" backLabel="Review Queue" />);
    expect(screen.getByRole("link", { name: "Review Queue" }).getAttribute("href")).toBe("/");
  });

  it("sets the header in a full-width band that the title sits inside", () => {
    render(<PageHeader title="Settings" />);
    const band = screen.getByRole("heading", { level: 1 }).closest(".page-band");
    expect(band).not.toBeNull();
  });

  it("sets the title at the page-title scale", () => {
    render(<PageHeader title="Settings" />);
    expect(screen.getByRole("heading", { level: 1 }).classList.contains("text-title")).toBe(true);
  });
});
