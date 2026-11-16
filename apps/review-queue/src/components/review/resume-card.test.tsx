import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextSymbol } from "@/lib/session/store";
import { emptySession, HEAD_SHA, REF } from "@/test/review-fixture";
import { ResumeCard } from "./resume-card";

function symbol(name: string, pinned: boolean): ContextSymbol {
  return {
    name,
    kind: "function",
    path: "src/a.ts",
    line: 1,
    scope: "repo",
    signature: "",
    stepId: null,
    pinned,
    seenAt: "",
    origin: { name, path: "src/a.ts", line: 1, character: 0, side: "new" },
  };
}

describe("ResumeCard", () => {
  it("lists the names you pinned so they come back after a pause", () => {
    render(
      <ResumeCard
        session={emptySession({
          contextSymbols: [symbol("load", true), symbol("noise", false), symbol("Options", true)],
        })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
    expect(screen.getByText("You pinned")).toBeTruthy();
    expect(screen.getByText("load, Options")).toBeTruthy();
  });

  it("renders the pause note's Markdown inline", () => {
    render(
      <ResumeCard
        session={emptySession({ pause: { note: "Check **retry** in `load`", at: "" } })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
    expect(screen.getByText("retry").tagName).toBe("STRONG");
    expect(screen.getByText("load").tagName).toBe("CODE");
  });

  it("renders the last note's Markdown inline", () => {
    render(
      <ResumeCard
        session={emptySession({
          notes: [
            {
              side: "new",
              startLine: null,
              id: 9,
              path: null,
              line: null,
              kind: "nitpick",
              decorations: [],
              body: "Rename `foo`",
              createdAt: "",
            },
          ],
        })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("offers to show what changed only when a baseline was kept", () => {
    const onShowChanges = vi.fn();
    const { rerender } = render(
      <ResumeCard
        session={emptySession({ baselineHeadSha: "4".repeat(40) })}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={onShowChanges}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show what changed" }));
    expect(onShowChanges).toHaveBeenCalledOnce();

    rerender(
      <ResumeCard
        session={emptySession()}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={onShowChanges}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
    expect(screen.queryByRole("button", { name: "Show what changed" })).toBeNull();
  });
});

describe("ResumeCard's summary of what changed", () => {
  const SINCE_LAST_LOOK = emptySession({ baselineHeadSha: "4".repeat(40) });

  function renderWithChanges() {
    return render(
      <ResumeCard
        session={SINCE_LAST_LOOK}
        steps={[]}
        nextStep={null}
        reopenedCount={0}
        onContinue={vi.fn()}
        onShowChanges={vi.fn()}
        pullRequest={REF}
        headSha={HEAD_SHA}
      />,
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("shows the model's guess about the new commits, marked as a guess", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "ready",
          summary: { summary: "The new commits add a retry.", model: "m" },
        }),
      ),
    );
    renderWithChanges();
    expect(await screen.findByText("The new commits add a retry.")).toBeTruthy();
    expect(screen.getByText(/The model's guess, unverified/)).toBeTruthy();
  });

  it("offers to try again when the local model fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "error", message: "down" })),
    );
    renderWithChanges();
    expect(await screen.findByText("Local model unavailable (down).")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("shows no summary when the change is too large to read quickly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ status: "skipped" })),
    );
    renderWithChanges();
    await waitFor(() => expect(screen.queryByText(/reading what changed/)).toBeNull());
    expect(screen.queryByText(/The model's guess/)).toBeNull();
    expect(screen.getByRole("button", { name: "Show what changed" })).toBeTruthy();
  });
});
