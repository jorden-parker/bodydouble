import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReviewComment } from "@/lib/github/gh";
import { ASSIST_REPLY, installFakeApi, SUBMITTED_REVIEW_URL } from "@/test/fake-api";
import { emptySession, HEAD_SHA, REF, reviewPayload } from "@/test/review-fixture";
import { ReviewLoader } from "./review-loader";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

async function renderReview(
  payload = reviewPayload(),
  orientation?: unknown,
  explanations?: unknown[],
) {
  const api = installFakeApi(payload, orientation, explanations);
  const user = userEvent.setup();
  render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
  await startReading(user);
  return { api, user };
}

async function renderBrief(orientation?: unknown, payload = reviewPayload()) {
  const api = installFakeApi(payload, orientation);
  const user = userEvent.setup();
  render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
  await screen.findByRole("heading", { level: 2, name: "Add retrying client" });
  return { api, user };
}

async function startReading(user: UserEvent) {
  await waitFor(() =>
    expect(
      document.getElementById("brief-heading") ?? document.getElementById("step-heading"),
    ).not.toBeNull(),
  );
  const start = screen.queryByRole("button", { name: /Start with step 1/ });
  if (start) {
    await user.click(start);
    await screen.findByText(/^Step \d of 3/);
  }
}

function rail(): HTMLElement {
  return screen.getByRole("navigation", { name: "Review path" });
}

function isRegionShown(name: string): boolean {
  const role = name === "Review path" ? "navigation" : "complementary";
  return screen.getByRole(role, { name, hidden: true }).closest(".hidden") === null;
}

const DEFAULT_VIEWPORT_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setViewportWidth(DEFAULT_VIEWPORT_WIDTH);
  Reflect.deleteProperty(document, "hidden");
});

const MODEL_ON = { status: "error", message: "x" };

function selectFirstLine(path: string) {
  const row = document.querySelector(`[data-path="${path}"][data-hunk="0"][data-line="0"]`);
  const range = document.createRange();
  range.selectNodeContents(row as Node);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  act(() => {
    document.dispatchEvent(new Event("selectionchange"));
  });
}

describe("ReviewLoader", () => {
  it("shows a loading message, then the brief with the facts and the path", async () => {
    installFakeApi(reviewPayload());
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(screen.getByText("Getting the PR ready…")).toBeTruthy();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Add retrying client" }),
    ).toBeTruthy();
    expect(screen.getByText("~2 min")).toBeTruthy();
    expect(within(rail()).getByRole("button", { name: "Brief" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(within(rail()).getByRole("button", { name: /Wrap up/ })).toBeTruthy();
  });

  it("shows the first step after the brief, with its role and size", async () => {
    await renderReview();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
  });

  it("shows an error when the PR cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "gh failed" }, { status: 502 })),
    );
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findByText("gh failed")).toBeTruthy();
  });

  it("shows the local model summary on the brief when ready", async () => {
    await renderBrief({
      status: "ready",
      orientation: {
        model: "m",
        summary: "Adds retries to loading.",
        intent: "Loads fail on flaky networks.",
        risk: "medium",
        stepOrder: [],
        hotspotNotes: [{ id: "debug-output:src/client.ts:11", note: "Drop the log." }],
        extraHotspots: [
          { path: "src/client.ts", line: 10, title: "No backoff", why: "Hammers the server." },
        ],
      },
    });
    expect(await screen.findByText("Adds retries to loading.")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    expect(screen.getAllByText(/unverified/i).length).toBeGreaterThan(0);
  });

  it("suggests the model's order and reads the steps in it once the reader chooses it", async () => {
    const { user } = await renderBrief({
      status: "ready",
      orientation: {
        model: "m",
        summary: "Adds retries to loading.",
        intent: "Loads fail on flaky networks.",
        risk: "medium",
        stepOrder: [
          { id: "core:src/client.ts:0", why: "The retry loop lives here." },
          { id: "types:src/types.ts:0", why: "Then the options it reads." },
          { id: "generated:pnpm-lock.yaml:0", why: "Last, the lockfile." },
        ],
        hotspotNotes: [],
        extraHotspots: [],
      },
    });
    expect(
      await screen.findByText(/The model suggests reading client\.ts before types\.ts/),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use that order" }));
    expect(within(rail()).getByRole("button", { name: /1\. client\.ts/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Start with step 1/ }));
    expect(await screen.findByText(/The retry loop lives here/)).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
  });

  it("keeps the built-in order while the local model is still ordering the steps", async () => {
    await renderBrief(new Promise(() => {}));
    expect(screen.getByText(/^Local model is .+ You can start now\.$/)).toBeTruthy();
    expect(within(rail()).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText(/suggests reading/)).toBeNull();
  });

  it("falls back to the built-in order when the local model is unavailable", async () => {
    const { user } = await renderBrief({ status: "error", message: "connection refused" });
    expect(await screen.findByText(/connection refused/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByText("Steps are in the built-in order and ready now.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Start with step 1/ }));
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
  });

  it("explains the current step without being asked", async () => {
    await renderReview(reviewPayload(), MODEL_ON);
    expect(await screen.findByText("Adds the Options type.")).toBeTruthy();
    expect(screen.getByText("Is retries optional?")).toBeTruthy();
  });

  it("asks the model more about a step check", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(
      await screen.findByRole("button", { name: "Ask more about: Is retries optional?" }),
    );
    const chat = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(chat).getByText("Tell me more: Is retries optional?")).toBeTruthy();
    await waitFor(() =>
      expect(api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body).toMatchObject({
        action: "explain",
        target: { kind: "check", check: 0 },
        history: [],
      }),
    );
  });

  it("offers no ask-more button when the model is off", async () => {
    await renderReview();
    expect(screen.queryByRole("button", { name: /Ask more/ })).toBeNull();
  });

  it("asks for no explanation when the model is off", async () => {
    const { api } = await renderReview();
    expect(api.calls.some((call) => call.url.includes("/explanation"))).toBe(false);
  });

  it("retries a failed step explanation", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON, [
      { status: "error", message: "timed out" },
    ]);
    expect(await screen.findByText(/timed out/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Adds the Options type.")).toBeTruthy();
  });

  it("keeps the brief open with a retry when the orientation request fails", async () => {
    await renderBrief(Response.json({ error: "Review is not loaded" }, { status: 409 }));
    expect(await screen.findByText(/Review is not loaded/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("starts the review over after confirming, keeping notes by default", async () => {
    const payload = reviewPayload(
      emptySession({
        doneSteps: ["types:src/types.ts:0"],
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: null,
            line: null,
            kind: "parked",
            decorations: [],
            body: "later",
            createdAt: "",
          },
        ],
      }),
    );
    const { api, user } = await renderReview(payload);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("button", { name: "Start over" }));
    const dialog = screen.getByRole("dialog", { name: "Start this review over?" });
    expect(within(dialog).getByRole("checkbox", { name: /Also delete my 1 note/ })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.actions()).toContainEqual({ type: "start-over", keepNotes: true });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Add retrying client" }),
    ).toBeTruthy();
  });

  it("keeps progress when starting over is cancelled", async () => {
    const { api, user } = await renderReview();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Keep my progress" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.actions()).not.toContainEqual(expect.objectContaining({ type: "start-over" }));
  });

  it("marks a step done and moves to the next one", async () => {
    const { api, user } = await renderReview();
    await user.click(screen.getByRole("button", { name: /Done, next step/ }));
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "step-done", stepId: "types:src/types.ts:0", done: true },
        { type: "current-step", stepId: "core:src/client.ts:0", headSha: HEAD_SHA },
      ]),
    );
  });

  it("shows what changed since you last looked and catches up", async () => {
    const payload = {
      ...reviewPayload(emptySession({ baselineHeadSha: "4".repeat(40) })),
      reopenedStepIds: ["types:src/types.ts:0"],
    };
    const { api, user } = await renderReview(payload);
    await user.click(screen.getByRole("button", { name: "Show what changed" }));
    expect(await screen.findByText(/^Since you last looked/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "I've caught up" }));
    expect(api.actions()).toContainEqual({ type: "catch-up" });
    await waitFor(() => expect(screen.queryByText(/^Since you last looked/)).toBeNull());
  });

  it("notices a push when you come back after a long absence", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const { api } = await renderReview();
      api.head.current = "6".repeat(40);
      setDocumentHidden(true);
      clock.mockReturnValue(1_000_000 + 6 * 60 * 1000);
      setDocumentHidden(false);
      expect(await screen.findByText(/New commits were pushed/)).toBeTruthy();
    } finally {
      clock.mockRestore();
    }
  });

  it("labels the path, the step and the companion as three regions", async () => {
    await renderReview();
    expect(screen.getByRole("navigation", { name: "Review path" })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Companion" })).toBeTruthy();
  });

  it("hides and restores the path and the companion from the keyboard", async () => {
    const { user } = await renderReview();
    expect(isRegionShown("Review path")).toBe(true);
    await user.keyboard("{[}");
    expect(isRegionShown("Review path")).toBe(false);
    await user.keyboard("{[}");
    expect(isRegionShown("Review path")).toBe(true);
    await user.keyboard("{]}");
    expect(isRegionShown("Companion")).toBe(false);
    await user.keyboard("\\");
    expect(isRegionShown("Review path")).toBe(false);
    expect(isRegionShown("Companion")).toBe(false);
    await user.keyboard("\\");
    expect(isRegionShown("Review path")).toBe(true);
    expect(isRegionShown("Companion")).toBe(true);
  });

  it("opens Ask in the companion for selected lines, and removes the question from the thread", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const chat = await screen.findByRole("region", { name: "Ask the model" });
    expect(screen.getByRole("tab", { name: "Ask" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    await user.click(within(chat).getByRole("button", { name: "Remove this question" }));
    expect(within(chat).queryByRole("article")).toBeNull();
  });

  it("keeps an open chat when the path moves to another step", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    await screen.findByRole("region", { name: "Ask the model" });
    await user.click(within(rail()).getByRole("button", { name: /2\. client\.ts/ }));
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Ask the model" })).toBeTruthy();
  });

  it("opens the hidden companion when a chat starts", async () => {
    const { user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.keyboard("{]}");
    expect(isRegionShown("Companion")).toBe(false);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    expect(await screen.findByRole("region", { name: "Ask the model" })).toBeTruthy();
    expect(isRegionShown("Companion")).toBe(true);
  });

  it("moves between steps with the keyboard and toggles the whole PR", async () => {
    const { user } = await renderReview();
    await user.keyboard("n");
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByText("core, 2 lines")).toBeTruthy();
    await user.keyboard("p");
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByText("types, 1 line")).toBeTruthy();
    await user.keyboard("jk");
    await user.keyboard("a");
    expect(screen.getByRole("button", { name: /One step at a time/ })).toBeTruthy();
    expect(screen.getByText("Collapsed: usually safe to skim. Show anyway")).toBeTruthy();
    await user.click(screen.getByText("Collapsed: usually safe to skim. Show anyway"));
    expect(screen.getByText("lock: 1")).toBeTruthy();
  });

  it("peeks a definition, jumps to it and comes back", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    const peek = await screen.findByRole("region", { name: "Options" });
    expect(await within(peek).findByTitle("src/types.ts")).toBeTruthy();
    expect(within(peek).getByText("type", { selector: "[data-slot=badge]" })).toBeTruthy();
    expect(within(peek).getByText("export type").closest(".code-token")).toBeTruthy();
    expect(document.querySelector(".grid-cols-workspace")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /In this PR/ }));
    expect(await screen.findByRole("button", { name: /Back to Options/ })).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: /References/ }));
    const reference = await screen.findByText("load(options: Options) {");
    expect(reference.closest("button")?.disabled).toBe(false);
    expect(screen.getByText("in this PR")).toBeTruthy();
    await user.hover(screen.getByRole("button", { name: /Back to Options/ }));
    expect(await screen.findAllByText("src/client.ts:10")).toBeTruthy();
    await user.keyboard("b");
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        { type: "jump-push", name: "Options", path: "src/client.ts", line: 10 },
        { type: "jump-pop" },
      ]),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Options" })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Context" })).getByRole("button", {
        name: "Open Options",
      }),
    ).toBeTruthy();
  });

  it("remembers peeked names in the Context tab and pins them", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(screen.getAllByRole("button", { name: "Options" })[0]);
    const peek = await screen.findByRole("region", { name: "Options" });
    await user.click(await within(peek).findByRole("button", { name: "Pin" }));
    expect(within(peek).getByRole("button", { name: "Unpin" })).toBeTruthy();
    await user.keyboard("{Escape}gc");
    expect(await screen.findByRole("button", { name: "Open Options" })).toBeTruthy();
    expect(screen.getByText("type Options = { retries: number }")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe("true");
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "symbol-seen" }),
        expect.objectContaining({ type: "symbol-pin", pinned: true }),
      ]),
    );
  });

  it("shows how often a changed declaration is referenced and lists the references", async () => {
    const { api, user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.click(await screen.findByRole("button", { name: "2 references to load" }));
    expect(await screen.findByText("load(options: Options) {")).toBeTruthy();
    expect(api.calls.map((call) => call.url)).toContainEqual(
      expect.stringContaining("/references?sha=5555"),
    );
    expect(api.calls.map((call) => call.url)).toContainEqual(
      expect.stringContaining("name=load&path=src%2Fclient.ts&line=10&character=16&side=new"),
    );
  });

  it("lands a hotspot that names no line on the first changed line of its file", async () => {
    const payload = reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" }));
    const churn = { ...payload.hotspots[0], id: "churn:src/client.ts", line: null, title: "Busy" };
    const { user } = await renderReview({ ...payload, hotspots: [churn] });
    await user.click(within(rail()).getByRole("button", { name: /Busy/ }));
    const landed = document.querySelector("[aria-current=location]");
    expect(landed?.getAttribute("id")).toBe("line-src/client.ts-10");
  });

  it("opens a collapsed lockfile when its hotspot is clicked", async () => {
    const payload = reviewPayload(emptySession({ currentStepId: "generated:pnpm-lock.yaml:0" }));
    const drift = {
      ...payload.hotspots[0],
      id: "lockfile-drift:pnpm-lock.yaml",
      path: "pnpm-lock.yaml",
      line: null,
      title: "Lockfile drift",
    };
    const { user } = await renderReview({ ...payload, hotspots: [drift] });
    await user.click(within(rail()).getByRole("button", { name: /Lockfile drift/ }));
    const landed = document.querySelector("[aria-current=location]");
    expect(landed?.getAttribute("id")).toBe("line-pnpm-lock.yaml-1");
  });

  it("outlines the step's files and goes to a symbol or peeks one outside the diff", async () => {
    const { user } = await renderReview(
      reviewPayload(emptySession({ currentStepId: "core:src/client.ts:0" })),
    );
    await user.keyboard("go");
    const outline = await screen.findByRole("region", { name: "Outline" });
    await user.click(await within(outline).findByRole("button", { name: "Collapse load" }));
    expect(within(outline).queryByRole("button", { name: /attempts/ })).toBeNull();
    await user.click(within(outline).getByRole("button", { name: "Expand load" }));
    await user.click(within(outline).getByRole("button", { name: /^load/ }));
    const landed = document.querySelector("[aria-current=location]");
    expect(landed?.getAttribute("id")).toBe("line-src/client.ts-10");
    await user.click(within(outline).getByRole("button", { name: /^retry/ }));
    expect(await screen.findByRole("region", { name: "retry" })).toBeTruthy();
  });

  it("marks a line that has a GitHub thread and opens the conversation from it", async () => {
    const thread: ReviewComment = {
      id: 1,
      inReplyTo: null,
      path: "src/types.ts",
      line: 1,
      side: "RIGHT",
      author: "sam",
      body: "Should this be exported?",
      url: "https://github.com/acme/app/pull/7#discussion_r1",
      createdAt: "2026-10-01T10:00:00Z",
    };
    installFakeApi(reviewPayload(), undefined, undefined, undefined, {
      comments: [thread],
      reviews: [],
      truncated: false,
      viewer: null,
    });
    const user = userEvent.setup();
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    await startReading(user);
    await user.click(await screen.findByRole("button", { name: "Show 1 GitHub thread" }));
    expect(await screen.findByText("Should this be exported?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "GitHub" }).getAttribute("data-state")).toBe("on");
  });

  it("adds a line note with the keyboard and parks a thought", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    await user.click(screen.getByRole("button", { name: "blocking" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Needs a default");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect((await screen.findAllByText("Needs a default")).length).toBeGreaterThan(0);
    await user.keyboard("P");
    const parking = await screen.findByPlaceholderText(/Park it here/);
    await waitFor(() => expect(document.activeElement).toBe(parking));
    await user.type(parking, "Check logging later{Enter}");
    expect(await screen.findByText("Check logging later")).toBeTruthy();
    expect(api.actions()).toEqual(
      expect.arrayContaining([
        {
          type: "note-add",
          path: "src/types.ts",
          line: 1,
          side: "new",
          startLine: null,
          kind: "issue",
          decorations: ["blocking"],
          body: "Needs a default",
        },
        {
          type: "note-add",
          path: null,
          line: null,
          side: "new",
          startLine: null,
          kind: "parked",
          decorations: [],
          body: "Check logging later",
        },
      ]),
    );
  });

  it("keeps a refused note out of the review and says why", async () => {
    const { api, user } = await renderReview();
    api.refuseNextSessionAction("Note body is too long");
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Needs a default");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(await screen.findByText("Couldn't save: Note body is too long")).toBeTruthy();
    expect(screen.queryByText("Needs a default")).toBeNull();
  });

  it("shows one notice at a time and says how many more wait behind it", async () => {
    const payload = reviewPayload();
    const merged = { ...payload, pr: { ...payload.pr, state: "merged" as const } };
    const { api, user } = await renderReview(merged);
    expect(screen.getByText(/already merged/)).toBeTruthy();
    expect(screen.queryByText(/more notice/)).toBeNull();
    api.refuseNextSessionAction("Note body is too long");
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Issue" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Needs a default");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Couldn't save: Note body is too long",
    );
    expect(screen.getByText("1 more notice waiting behind this one.")).toBeTruthy();
  });

  it("offers every label and keeps a non-blocking decoration with its hint", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("c");
    await user.click(screen.getByRole("button", { name: "Suggestion" }));
    expect(screen.getByText("A proposed improvement. Say what and why.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "blocking" }));
    await user.click(screen.getByRole("button", { name: "non-blocking" }));
    await user.type(screen.getByPlaceholderText(/What did you notice/), "Extract a helper");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect((await screen.findAllByText("Extract a helper")).length).toBeGreaterThan(0);
    expect(api.actions()).toContainEqual({
      type: "note-add",
      path: "src/types.ts",
      line: 1,
      side: "new",
      startLine: null,
      kind: "suggestion",
      decorations: ["non-blocking"],
      body: "Extract a helper",
    });
  });

  it("opens and ticks off hotspots from the path", async () => {
    const { api, user } = await renderReview();
    await user.keyboard("n");
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    await user.click(within(rail()).getByRole("button", { name: /Debug output left in/ }));
    const stepHotspots = within(rail()).getByRole("region", { name: "Hotspots in this step" });
    await user.click(within(stepHotspots).getByTitle("Checked"));
    expect(api.actions()).toContainEqual({
      type: "hotspot-checked",
      hotspotId: "debug-output:src/client.ts:11",
      checked: true,
    });
  });

  it("pauses with a note and welcomes you back with it", async () => {
    const { api, user } = await renderReview();
    await user.keyboard(".");
    const input = screen.getByPlaceholderText(/check the retry loop/);
    await user.type(input, "look at Options next");
    await user.click(within(input.closest("form")!).getByRole("button", { name: "Pause" }));
    expect(api.actions()).toContainEqual({ type: "pause", note: "look at Options next" });

    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10 * 60 * 1000);
    act(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vi.restoreAllMocks();
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("look at Options next")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(api.actions()).toContainEqual({ type: "resume" });
  });

  it("greets with reopened steps after new commits", async () => {
    const payload = reviewPayload(emptySession({ doneSteps: ["types:src/types.ts:0"] }));
    installFakeApi({ ...payload, reopenedStepIds: ["core:src/client.ts:0"] });
    render(<ReviewLoader pullRequest={REF} />, { wrapper: TooltipProvider });
    expect(await screen.findByText("Welcome back")).toBeTruthy();
    expect(screen.getByText(/New commits changed 1 step/)).toBeTruthy();
  });

  it("posts the seen request once per load, even when React runs effects twice", async () => {
    const api = installFakeApi(reviewPayload());
    render(
      <StrictMode>
        <ReviewLoader pullRequest={REF} />
      </StrictMode>,
      { wrapper: TooltipProvider },
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: "Add retrying client" }),
    ).toBeTruthy();
    expect(api.calls.filter((call) => call.url.includes("/seen"))).toHaveLength(1);
  });

  it("opens the command palette with the keyboard and jumps to a step", async () => {
    const { user } = await renderReview();
    await user.keyboard("{Control>}k{/Control}");
    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    await user.type(within(palette).getByLabelText("Search commands"), "step 2");
    await user.click(within(palette).getByRole("button", { name: /Step 2: client\.ts/ }));
    expect(await screen.findByText("Step 2 of 3")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
  });

  it("finishes the review from Wrap up and posts selected notes", async () => {
    const payload = reviewPayload(
      emptySession({
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: "src/client.ts",
            line: 11,
            kind: "nitpick",
            decorations: [],
            body: "rename",
            createdAt: "",
          },
        ],
      }),
    );
    const { api, user } = await renderBrief(undefined, payload);
    await user.click(within(rail()).getByRole("button", { name: /Wrap up/ }));
    const page = await screen.findByRole("article", { name: "Post your review" });
    expect(within(page).getByText(/3 steps and 1 hotspot are not/)).toBeTruthy();
    await user.click(within(page).getByRole("radio", { name: "Approve" }));
    await user.type(within(page).getByPlaceholderText(/Overall summary/), "Nice work");
    await user.click(within(page).getByRole("button", { name: "Post review" }));
    expect(await screen.findByText(/Review posted/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open it" }).getAttribute("href")).toBe(
      SUBMITTED_REVIEW_URL,
    );
    expect(api.calls.find((call) => call.url.endsWith("/submit"))?.body).toEqual({
      event: "APPROVE",
      summary: "Nice work",
      noteIds: [3],
      headSha: HEAD_SHA,
    });
  });

  it("drafts the summary from notes on Wrap up", async () => {
    const payload = reviewPayload(
      emptySession({
        notes: [
          {
            side: "new",
            startLine: null,
            id: 3,
            path: "src/client.ts",
            line: 11,
            kind: "nitpick",
            decorations: [],
            body: "rename",
            createdAt: "",
          },
        ],
      }),
    );
    const { user } = await renderBrief({ status: "error", message: "x" }, payload);
    await user.click(within(rail()).getByRole("button", { name: /Wrap up/ }));
    const page = await screen.findByRole("article", { name: "Post your review" });
    await user.click(within(page).getByRole("button", { name: /Draft from my notes/ }));
    await waitFor(() =>
      expect(within(page).getByPlaceholderText(/Overall summary/)).toHaveProperty(
        "value",
        "Looks good overall; one question on retries.",
      ),
    );
  });

  it("has no draft button on Wrap up when the model is off", async () => {
    const { user } = await renderReview();
    await user.click(within(rail()).getByRole("button", { name: /Wrap up/ }));
    const page = await screen.findByRole("article", { name: "Post your review" });
    expect(within(page).queryByRole("button", { name: /Draft from my notes/ })).toBeNull();
  });

  it("shows the keyboard help", async () => {
    const { user } = await renderReview();
    await user.keyboard("?");
    expect(screen.getByText("Keyboard")).toBeTruthy();
    expect(screen.getByText("Hotspots in this step, in the path")).toBeTruthy();
    expect(screen.getByText("Context: the PR's comments and your posts")).toBeTruthy();
    await user.click(screen.getByText("Keyboard"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Keyboard")).toBeNull();
  });

  it("focuses the current step's hotspots and opens the GitHub view from the keyboard", async () => {
    const { user } = await renderReview();
    await user.keyboard("gh");
    await waitFor(() => expect(document.activeElement?.id).toBe("path-hotspots"));
    await user.keyboard("gg");
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "GitHub" }).getAttribute("data-state")).toBe("on"),
    );
  });

  it("explains selected lines in the companion and takes a follow-up on the same exchange", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    await user.type(within(panel).getByLabelText("Your question"), "Why a number?{Enter}");
    await waitFor(() =>
      expect(api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body).toMatchObject({
        action: "explain",
        target: { kind: "lines", range: { path: "src/types.ts" } },
        history: [
          { role: "assistant", content: ASSIST_REPLY.join("") },
          { role: "user", content: "Why a number?" },
        ],
      }),
    );
    expect(within(panel).getAllByRole("article")).toHaveLength(1);
  });

  it("asks about a whole file from its header", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getAllByRole("button", { name: /Actions/ })[0]);
    const toolbar = screen.getByRole("toolbar", { name: "File actions" });
    await user.click(within(toolbar).getByRole("button", { name: /Simplify/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(panel).getByText("Simplify this file")).toBeTruthy();
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    const request = api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body;
    expect(request).toMatchObject({ action: "simplify", target: { kind: "file" } });
  });

  it("reviews a whole file from its actions", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    await user.click(screen.getAllByRole("button", { name: /Actions/ })[0]);
    const toolbar = screen.getByRole("toolbar", { name: "File actions" });
    await user.click(within(toolbar).getByRole("button", { name: /Review/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(within(panel).getByText("Review this file")).toBeTruthy();
    const request = api.calls.filter((call) => call.url.includes("/assist")).at(-1)?.body;
    expect(request).toMatchObject({ action: "review", target: { kind: "file" } });
  });

  it("keeps each exchange in the PR's thread, so it is still there after switching tabs", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    const toolbar = await screen.findByRole("toolbar", { name: /selected lines/ });
    await user.click(within(toolbar).getByRole("button", { name: /Explain/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    await within(panel).findByText(ASSIST_REPLY.join(""));
    await waitFor(() =>
      expect(api.actions()).toContainEqual(expect.objectContaining({ type: "assist-save" })),
    );
    await user.click(screen.getByRole("tab", { name: /Notes/ }));
    await user.click(screen.getByRole("tab", { name: "Ask" }));
    expect(
      within(await screen.findByRole("region", { name: "Ask the model" })).getByText(
        ASSIST_REPLY.join(""),
      ),
    ).toBeTruthy();
  });

  it("drafts a review comment from an answer and saves it as a line note", async () => {
    const { api, user } = await renderReview(reviewPayload(), MODEL_ON);
    selectFirstLine("src/types.ts");
    await user.click(await screen.findByRole("button", { name: /Comment/ }));
    const panel = await screen.findByRole("region", { name: "Ask the model" });
    expect(await within(panel).findByText(ASSIST_REPLY.join(""))).toBeTruthy();
    await user.click(within(panel).getByRole("button", { name: "Turn into a comment" }));
    await user.click(await within(panel).findByRole("button", { name: "Issue" }));
    await user.click(within(panel).getByRole("button", { name: "blocking" }));
    await user.click(within(panel).getByRole("button", { name: "Save as note on L1" }));
    expect(api.actions()).toContainEqual({
      type: "note-add",
      path: "src/types.ts",
      line: 1,
      side: "new",
      startLine: null,
      kind: "issue",
      decorations: ["blocking"],
      body: ASSIST_REPLY.join(""),
    });
    expect(within(panel).getByRole("button", { name: "Saved to your notes" })).toBeTruthy();
  });

  it("offers no selection toolbar when the model is off", async () => {
    await renderReview();
    selectFirstLine("src/types.ts");
    expect(screen.queryByRole("toolbar", { name: /selected lines/ })).toBeNull();
  });
});
