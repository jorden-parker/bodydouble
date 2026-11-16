import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySession, reviewPayload } from "@/test/review-fixture";
import { BriefPage } from "./brief-page";
import type { Workspace } from "./use-workspace";

const WORKSPACE = {
  linkedIssues: { issues: [] },
  hotspots: [],
  setStepOrder: vi.fn(),
  goTo: vi.fn(),
  selectStep: vi.fn(),
} as unknown as Workspace;

function renderLoadingBrief() {
  return render(
    <BriefPage
      review={reviewPayload()}
      session={emptySession()}
      builtInStepIds={[]}
      orientation={{ status: "loading" }}
      workspace={WORKSPACE}
      onRetryOrientation={vi.fn()}
    />,
  );
}

function stubProgress(explained: number, total: number) {
  const fetchImpl = vi.fn(async () => Response.json({ explained, total }));
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "visibilityState");
});

describe("BriefPage while the model works", () => {
  it("says which step the model is reading and that the reader can start now", async () => {
    stubProgress(3, 6);
    renderLoadingBrief();
    expect(await screen.findByText(/reading step 4 of 6/)).toBeTruthy();
    expect(screen.getByText(/You can start now/)).toBeTruthy();
  });

  it("does not read progress while the tab is hidden", async () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const fetchImpl = stubProgress(0, 6);
    renderLoadingBrief();
    await waitFor(() => expect(screen.getByText(/You can start now/)).toBeTruthy());
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
