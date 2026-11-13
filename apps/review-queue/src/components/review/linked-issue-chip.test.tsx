import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LinkedIssue } from "@/lib/github/gh";
import { LinkedIssueChip } from "./linked-issue-chip";

function issue(overrides: Partial<LinkedIssue> = {}): LinkedIssue {
  return {
    owner: "acme",
    repo: "app",
    number: 1187,
    title: "Search Feels Laggy",
    state: "open",
    url: "https://github.com/acme/app/issues/1187",
    bodyHtml: "",
    ...overrides,
  };
}

describe("LinkedIssueChip", () => {
  it("renders nothing when the pull request closes no issue", () => {
    const { container } = render(<LinkedIssueChip issues={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("links the first issue out to GitHub", () => {
    render(<LinkedIssueChip issues={[issue()]} />);
    const link = screen.getByRole("link", { name: /acme\/app#1187/ });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/issues/1187");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it("counts the other issues after the first", () => {
    render(
      <LinkedIssueChip issues={[issue(), issue({ number: 1190 }), issue({ number: 1191 })]} />,
    );
    expect(screen.getByText("+2")).toBeTruthy();
  });
});
