import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { InProgressSession } from "@/lib/session/store";
import { InProgressList } from "./in-progress-list";

const SESSION: InProgressSession = {
  key: "acme/app#7",
  title: "Add retry",
  doneCount: 2,
  pauseNote: null,
  updatedAt: "2026-10-28T09:00:00.000Z",
};

const FIX_CACHE: InProgressSession = {
  key: "acme/app#8",
  title: "Fix cache",
  doneCount: 1,
  pauseNote: null,
  updatedAt: "2026-10-27T09:00:00.000Z",
};

function renderList(sessions: InProgressSession[], onArchive = vi.fn()) {
  render(
    <InProgressList
      sessions={sessions}
      busy={false}
      onArchive={onArchive}
      headingRef={createRef<HTMLHeadingElement>()}
    />,
    { wrapper: TooltipProvider },
  );
  return onArchive;
}

describe("InProgressList", () => {
  it("renders nothing when no session is in progress", () => {
    const { container } = render(
      <InProgressList
        sessions={[]}
        busy={false}
        onArchive={vi.fn()}
        headingRef={createRef<HTMLHeadingElement>()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("labels each row's archive button with its PR key", () => {
    renderList([SESSION]);
    expect(screen.getByRole("button", { name: "Archive acme/app#7" })).toBeTruthy();
  });

  it("passes the session to onArchive when its archive button is clicked", async () => {
    const onArchive = renderList([SESSION]);
    await userEvent.click(screen.getByRole("button", { name: "Archive acme/app#7" }));
    expect(onArchive).toHaveBeenCalledWith(SESSION);
  });

  it("links the resume button to its pull request", () => {
    renderList([SESSION]);
    expect(screen.getByRole("link", { name: /Resume review/ }).getAttribute("href")).toBe(
      "/pr/acme/app/7",
    );
  });

  it("shows the first session on the four review phases, at Walk the changes once a step is done", () => {
    renderList([SESSION]);
    const stream = screen.getByRole("progressbar", { name: "Review progress" });
    expect(stream.getAttribute("aria-valuemax")).toBe("4");
    expect(stream.getAttribute("aria-valuenow")).toBe("2");
    expect(stream.getAttribute("aria-valuetext")).toBe("Walk the changes");
    expect(screen.getByText("Conversation")).toBeTruthy();
  });

  it("places a session with no step done at Orient", () => {
    renderList([{ ...SESSION, doneCount: 0, pauseNote: "later" }]);
    const stream = screen.getByRole("progressbar", { name: "Review progress" });
    expect(stream.getAttribute("aria-valuenow")).toBe("1");
    expect(stream.getAttribute("aria-valuetext")).toBe("Orient");
  });

  it("keeps the steps done chip beside the phases", () => {
    renderList([SESSION]);
    expect(screen.getByText("2 steps done")).toBeTruthy();
  });

  it("lists the other sessions as rows under Also in Progress", () => {
    renderList([SESSION, FIX_CACHE]);
    expect(screen.getByRole("heading", { name: /Also in Progress \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Fix cache/ }).getAttribute("href")).toBe(
      "/pr/acme/app/8",
    );
  });

  it("makes the resume button soft when another action is the primary one", () => {
    render(
      <InProgressList
        sessions={[SESSION]}
        busy={false}
        onArchive={vi.fn()}
        headingRef={createRef<HTMLHeadingElement>()}
        isResumePrimary={false}
      />,
      { wrapper: TooltipProvider },
    );
    expect(screen.getByRole("link", { name: /Resume review/ }).getAttribute("data-variant")).toBe(
      "soft",
    );
  });

  it("links each row to its pull request on GitHub outside the row link", () => {
    renderList([SESSION]);
    const link = screen.getByRole("link", { name: "Open acme/app#7 on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/acme/app/pull/7");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.closest('a[href^="/pr/"]')).toBeNull();
  });

  it("draws the resume card on a hairline border rather than a ring", () => {
    const { container } = render(
      <InProgressList
        sessions={[SESSION]}
        busy={false}
        onArchive={vi.fn()}
        headingRef={createRef<HTMLHeadingElement>()}
      />,
      { wrapper: TooltipProvider },
    );
    const card = container.querySelector("article");
    expect(card?.classList.contains("border")).toBe(true);
    expect(card?.classList.contains("ring-1")).toBe(false);
  });
});
