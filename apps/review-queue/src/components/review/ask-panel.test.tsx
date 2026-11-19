import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import { HEAD_SHA, reviewPayload } from "@/test/review-fixture";
import { fetchModelStatus } from "@/components/review/api";
import type { ReviewPayload } from "@/lib/review/prepare";
import { NOTE_KIND_STYLES } from "./note-kinds";
import type { LiveExchange } from "./use-assist";
import type { Workspace } from "./use-workspace";
import { AskPanel } from "./ask-panel";

vi.mock("@/components/review/api", () => ({ fetchModelStatus: vi.fn(async () => null) }));

const HEAD = HEAD_SHA;
const RANGE = { path: "src/client.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 1 } };
const FILE_TARGET = { kind: "file" as const, path: "src/client.ts" };

function exchange(turns: AssistTurn[], overrides: Partial<AssistThread> = {}): AssistThread {
  return {
    id: "6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f",
    headSha: HEAD,
    target: FILE_TARGET,
    action: "explain",
    question: null,
    turns,
    ...overrides,
  };
}

const QUESTION: AssistTurn = { role: "reviewer", text: "Explain this" };

const MODEL_STATUS = {
  isEnabled: true,
  backend: "local",
  server: "ollama",
  model: "qwen",
  size: "9B",
  isUsable: true,
  reason: null,
  isServerAnswering: true,
  isAwake: true,
  claudeModel: "haiku",
  lanes: { running: null, queued: { interactive: 0, background: 0 } },
  speeds: {
    reading: { tokensPerSecond: 170, isMeasured: false },
    writing: { tokensPerSecond: 13, isMeasured: false },
  },
  start: { command: null, isStarting: false, failure: null },
} as const;

function live(thread: AssistThread, overrides: Partial<LiveExchange> = {}): LiveExchange {
  return {
    thread,
    phase: null,
    failure: null,
    isStreaming: false,
    isStopped: false,
    ...overrides,
  };
}

type Fixture = {
  exchanges?: AssistThread[];
  live?: LiveExchange | null;
  page?: "brief" | "step" | "wrapup";
  selection?: { range: typeof RANGE; top: number; left: number } | null;
  askTarget?: AssistThread["target"] | null;
};

function fakeWorkspace(review: ReviewPayload, fixture: Fixture = {}) {
  const exchanges = fixture.exchanges ?? [];
  const current = fixture.live ?? null;
  const assist = {
    exchanges,
    live: current,
    streaming: current?.isStreaming ?? false,
    start: vi.fn(),
    followUp: vi.fn(),
    rerun: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),
  };
  const workspace = {
    assist,
    page: fixture.page ?? "step",
    selection: fixture.selection ?? null,
    askTarget: fixture.askTarget ?? null,
    setAskTarget: vi.fn(),
    askAbout: vi.fn(),
    saveNote: vi.fn(),
    openLocation: vi.fn(),
    files: new Map(review.files.map((file) => [file.path, file])),
    currentStep: review.steps[1],
  };
  return { assist, workspace: workspace as unknown as Workspace };
}

function panel(fixture: Fixture = {}) {
  const review = reviewPayload();
  const { assist, workspace } = fakeWorkspace(review, fixture);
  return { assist, workspace, element: <AskPanel review={review} workspace={workspace} /> };
}

type Layout = { scrollHeight: number; clientHeight: number };

function fakeLayout(element: HTMLElement, layout: Layout) {
  let scrollTop = 0;
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => layout.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => layout.scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  return layout;
}

function readerScrollsUp(list: HTMLElement) {
  list.scrollTop = 100;
  fireEvent.scroll(list);
}

describe("AskPanel answers", () => {
  it("renders the reviewer's Markdown, with code shown as code", () => {
    const { element } = panel({
      exchanges: [exchange([{ role: "reviewer", text: "Is **this** safe?\n\nSee `load`." }])],
    });
    render(element);
    expect(screen.getByText("this").tagName).toBe("STRONG");
    expect(screen.getByText("load").tagName).toBe("CODE");
  });

  it("says when a model answer was cut off", () => {
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Half an", ended: "failed" }])],
    });
    render(element);
    expect(screen.getByText("The answer was cut off.")).toBeTruthy();
  });

  it("lists the lookups a model turn made, with each label's code shown", () => {
    const lookup = {
      tool: "find_references",
      label: "Callers and uses of `loadReview` (2)",
      paths: ["src/app.ts"],
    };
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Two callers.", lookups: [lookup] }])],
    });
    render(element);
    const list = screen.getByRole("list", { name: "Lookups" });
    expect(within(list).getByText("loadReview").tagName).toBe("CODE");
  });

  it("keeps a lookup label as one run of text so its file path flows after the verb", () => {
    const lookup = { tool: "read_file", label: "Read `src/a.ts` L1–L9", paths: ["src/a.ts"] };
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Read it.", lookups: [lookup] }])],
    });
    render(element);
    const list = screen.getByRole("list", { name: "Lookups" });
    const label = within(list).getByText("src/a.ts").parentElement;
    expect(label?.tagName).toBe("SPAN");
    expect(label?.textContent).toBe("Read src/a.ts L1–L9");
  });

  it("offers the Keep looking action only when the search used its whole budget", () => {
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Some.", hasBudgetEnded: true }])],
    });
    render(element);
    expect(screen.getByRole("button", { name: "Keep looking" })).toBeTruthy();
  });

  it("shows the answer came from Claude", () => {
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Sure.", isFromClaude: true }])],
    });
    render(element);
    expect(screen.getByText("From Claude")).toBeTruthy();
  });
});

describe("AskPanel scrolling", () => {
  it("follows a streaming answer", () => {
    const thread = exchange([QUESTION, { role: "model", text: "Part" }]);
    const first = panel({ exchanges: [thread], live: live(thread, { isStreaming: true }) });
    const { rerender } = render(first.element);
    const list = screen.getByTestId("chat-messages");
    fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    const longer = exchange([QUESTION, { role: "model", text: "Part one" }]);
    rerender(panel({ exchanges: [longer], live: live(longer, { isStreaming: true }) }).element);
    expect(list.scrollTop).toBe(1000);
  });

  it("stops following after the reader scrolls up", () => {
    const thread = exchange([QUESTION, { role: "model", text: "Part" }]);
    const view = render(
      panel({ exchanges: [thread], live: live(thread, { isStreaming: true }) }).element,
    );
    const list = screen.getByTestId("chat-messages");
    const layout = fakeLayout(list, { scrollHeight: 1000, clientHeight: 200 });

    readerScrollsUp(list);
    layout.scrollHeight = 1200;
    const longer = exchange([QUESTION, { role: "model", text: "Part one" }]);
    view.rerender(
      panel({ exchanges: [longer], live: live(longer, { isStreaming: true }) }).element,
    );
    expect(list.scrollTop).toBe(100);
  });
});

describe("AskPanel comment draft", () => {
  it("opens on the label the model wrote and leaves that label out of the text", async () => {
    const { element } = panel({
      exchanges: [
        exchange([{ role: "model", text: "suggestion: use `map`" }], { action: "comment" }),
      ],
    });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Turn into a comment" }));

    expect(screen.getByRole("button", { name: "Suggestion" }).className).toContain(
      NOTE_KIND_STYLES.suggestion,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Comment draft" });
    expect(textarea.value).toBe("use `map`");
  });

  it("reads the label from a draft the model wrapped in backticks", async () => {
    const { element } = panel({
      exchanges: [
        exchange([{ role: "model", text: "`suggestion: use `map``" }], { action: "comment" }),
      ],
    });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Turn into a comment" }));

    expect(screen.getByRole("button", { name: "Suggestion" }).className).toContain(
      NOTE_KIND_STYLES.suggestion,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Comment draft" });
    expect(textarea.value).toBe("use `map`");
  });
});

describe("AskPanel failures and retries", () => {
  it("shows the server's message for an unavailable model, with Try again and Ask Claude instead", () => {
    const thread = exchange([QUESTION]);
    const { element } = panel({
      exchanges: [thread],
      live: live(thread, {
        failure: { kind: "unavailable", message: "Nothing answers on `127.0.0.1:8435`." },
      }),
    });
    render(element);
    expect(screen.getByText(/Nothing answers on/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask Claude instead" })).toBeTruthy();
  });

  it("keeps a partial answer that ended early, and offers Retry", () => {
    const thread = exchange([QUESTION, { role: "model", text: "Half an", ended: "failed" }]);
    const { element } = panel({
      exchanges: [thread],
      live: live(thread, { failure: { kind: "ended-early", message: "The answer ended early." } }),
    });
    render(element);
    expect(screen.getByText("Half an")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("offers Retry after a stop that came before any answer", () => {
    const { element } = panel({ exchanges: [exchange([QUESTION])] });
    render(element);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("offers no Retry on an exchange asked on an older commit, only asking again", () => {
    const { element } = panel({ exchanges: [exchange([QUESTION], { headSha: "b".repeat(40) })] });
    render(element);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByText(/Asked on an older commit/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ask again on the new code" })).toBeTruthy();
  });
});

describe("AskPanel live status", () => {
  it("names the phase in a status region while the answer is waited on", () => {
    const thread = exchange([QUESTION]);
    const { element } = panel({
      exchanges: [thread],
      live: live(thread, { isStreaming: true, phase: { phase: "queued", ahead: 2 } }),
    });
    render(element);
    expect(screen.getByRole("status").textContent).toBe("Queued");
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  });

  it("says a stop came before any answer", () => {
    const thread = exchange([QUESTION]);
    const { element } = panel({ exchanges: [thread], live: live(thread, { isStopped: true }) });
    render(element);
    expect(screen.getByText("Stopped before the answer started.")).toBeTruthy();
  });

  it("clears the status once the answer has finished", () => {
    const { element } = panel({
      exchanges: [exchange([QUESTION, { role: "model", text: "Done" }])],
    });
    render(element);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("AskPanel composer", () => {
  it("explains that a step or lines come first on the brief, with no whole-PR question", () => {
    const { element } = panel({ page: "brief" });
    render(element);
    expect(screen.getByText(/Pick a step or select lines/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Your question" })).toBeNull();
  });

  it("names the next question's target and the model, and sends a question about it", async () => {
    vi.mocked(fetchModelStatus).mockResolvedValue(MODEL_STATUS);
    const { element, workspace } = panel({ selection: { range: RANGE, top: 0, left: 0 } });
    render(element);
    expect(screen.getByText("L10–11")).toBeTruthy();
    expect(await screen.findByText(/9B.*local/)).toBeTruthy();
    const box = screen.getByRole("textbox", { name: "Your question" });
    await userEvent.setup().type(box, "Why?{Enter}");
    expect(workspace.askAbout).toHaveBeenCalledWith({ kind: "lines", range: RANGE }, "Why?");
  });

  it("goes back to the step's file when nothing is selected", () => {
    const { element } = panel();
    render(element);
    expect(screen.getByText("whole file")).toBeTruthy();
  });
});

describe("AskPanel actions", () => {
  it("removes one question from the thread", async () => {
    const thread = exchange([QUESTION, { role: "model", text: "Done" }]);
    const { element, assist } = panel({ exchanges: [thread] });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove this question" }));
    expect(assist.remove).toHaveBeenCalledWith(thread.id);
  });

  it("asks for more detail by re-asking the same question", async () => {
    const thread = exchange([QUESTION, { role: "model", text: "Done" }]);
    const { element, assist } = panel({ exchanges: [thread] });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "More detail" }));
    expect(assist.rerun).toHaveBeenCalledWith(thread, { hasMoreDetail: true });
  });

  it("asks before sending anything to Claude, and keeps it local by default", async () => {
    const thread = exchange([QUESTION, { role: "model", text: "Done" }]);
    const { element, assist } = panel({ exchanges: [thread] });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ask Claude instead" }));

    const dialog = screen.getByRole("dialog", { name: "Send this question to Claude?" });
    expect(within(dialog).getByText(/Nothing else in the repository is sent/)).toBeTruthy();
    expect(assist.rerun).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("Keep it local");
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Keep it local" }));
    expect(assist.rerun).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("Ask Claude instead");
  });

  it("saves an answer as a note, with no line when it is about a whole file", async () => {
    const thread = exchange([QUESTION, { role: "model", text: "It loads once." }]);
    const { element, workspace } = panel({ exchanges: [thread] });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Save as note" }));
    expect(workspace.saveNote).toHaveBeenCalledWith(
      null,
      { kind: "question", decorations: [] },
      "It loads once.",
    );
    expect(screen.getByRole("button", { name: "Saved as note" })).toBeTruthy();
  });

  it("sends the question to Claude only on confirm", async () => {
    const thread = exchange([QUESTION, { role: "model", text: "Done" }]);
    const { element, assist } = panel({ exchanges: [thread] });
    render(element);
    await userEvent.setup().click(screen.getByRole("button", { name: "Ask Claude instead" }));
    await userEvent.setup().click(screen.getByRole("button", { name: /Send to Claude/ }));
    expect(assist.rerun).toHaveBeenCalledWith(thread, { shouldEscalate: true });
  });
});
