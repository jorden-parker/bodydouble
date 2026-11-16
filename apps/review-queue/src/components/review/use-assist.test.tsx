import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistTarget, AssistThread } from "@/lib/assist-protocol";
import { streamAssist } from "./api";
import type { ParsedAssistStream } from "./assist-stream";
import { useAssist } from "./use-assist";

vi.mock("./api", () => ({ streamAssist: vi.fn() }));

const REF = { owner: "acme", repo: "app", number: 7 };
const HEAD = "a".repeat(40);
const NEW_HEAD = "b".repeat(40);
const TARGET: AssistTarget = { kind: "file", path: "src/a.ts" };

function reply(text: string, extra: Partial<ParsedAssistStream> = {}): ParsedAssistStream {
  return { text, lookups: [], failure: null, hasBudgetEnded: false, ...extra };
}

function setup(initialSha = HEAD, saved: AssistThread[] = []) {
  const store = { save: vi.fn(), remove: vi.fn() };
  const hook = renderHook(
    ({ headSha }: { headSha: string }) => useAssist(REF, headSha, saved, store),
    { initialProps: { headSha: initialSha } },
  );
  const exchange = () => hook.result.current.exchanges[0];
  const lastText = () => exchange()?.turns.at(-1)?.text;
  return { ...hook, store, exchange, lastText };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useAssist failures", () => {
  it("re-sends the same request after a failed first answer", async () => {
    vi.mocked(streamAssist)
      .mockRejectedValueOnce(new Error("LLM request failed (HTTP 503)"))
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
        onUpdate(reply("It sets a.")),
      );
    const { result, exchange, lastText } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() =>
      expect(result.current.live?.failure?.message).toBe("LLM request failed (HTTP 503)"),
    );
    act(() => result.current.rerun(exchange(), {}));
    await waitFor(() => expect(lastText()).toBe("It sets a."));

    expect(streamAssist).toHaveBeenCalledTimes(2);
    expect(vi.mocked(streamAssist).mock.calls[1]?.[2]).toEqual(
      vi.mocked(streamAssist).mock.calls[0]?.[2],
    );
    expect(result.current.live?.failure).toBeNull();
  });

  it("keeps the kind of failure the stream reported", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => {
      onUpdate(reply("", { failureKind: "unavailable" }));
      throw new Error("Nothing answers on 127.0.0.1:8435");
    });
    const { result } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() =>
      expect(result.current.live?.failure).toEqual({
        kind: "unavailable",
        message: "Nothing answers on 127.0.0.1:8435",
      }),
    );
  });

  it("says the reader stopped before any answer came", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(
      (_ref, _sha, _request, _onUpdate, signal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { result } = setup();

    act(() => result.current.start(TARGET, "explain"));
    act(() => result.current.stop());

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.live?.isStopped).toBe(true);
  });

  it("drops a blank answer, so the question waits for a retry", async () => {
    vi.mocked(streamAssist).mockRejectedValueOnce(new Error("down"));
    const { result, store } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(store.save).toHaveBeenCalled());
    expect(store.save.mock.calls[0]?.[0].turns).toEqual([
      { role: "reviewer", text: "Explain this file" },
    ]);
  });

  it("keeps the partial answer when the reader stops mid-stream, and marks it stopped", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(
      (_ref, _sha, _request, onUpdate, signal) =>
        new Promise<void>((_resolve, reject) => {
          onUpdate(reply("It sets"));
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const { result, store, lastText } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(lastText()).toBe("It sets"));
    act(() => result.current.stop());

    await waitFor(() =>
      expect(store.save).toHaveBeenCalledWith(
        expect.objectContaining({
          turns: [
            { role: "reviewer", text: "Explain this file" },
            { role: "model", text: "It sets", ended: "stopped" },
          ],
        }),
      ),
    );
    expect(result.current.live?.failure).toBeNull();
  });

  it("saves a failed answer with what arrived and marks it failed", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => {
      onUpdate(reply("Half an", { failureKind: "ended-early" }));
      throw new Error("The model's answer ended early; try again");
    });
    const { result, store } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(result.current.live?.failure?.kind).toBe("ended-early"));
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          { role: "reviewer", text: "Explain this file" },
          { role: "model", text: "Half an", ended: "failed" },
        ],
      }),
    );
  });
});

describe("useAssist exchanges", () => {
  it("sends a follow-up as history on the same exchange, not as a new one", async () => {
    vi.mocked(streamAssist)
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
        onUpdate(reply("It sets a.")),
      )
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => onUpdate(reply("Once.")));
    const { result, exchange } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    act(() => result.current.followUp(exchange(), "Why?"));
    await waitFor(() => expect(result.current.streaming).toBe(false));

    expect(result.current.exchanges).toHaveLength(1);
    expect(vi.mocked(streamAssist).mock.calls[1]?.[2].history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("re-asks with more detail and replaces the answer", async () => {
    vi.mocked(streamAssist)
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => onUpdate(reply("Short.")))
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => onUpdate(reply("Longer.")));
    const { result, exchange, lastText } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(lastText()).toBe("Short."));
    act(() => result.current.rerun(exchange(), { hasMoreDetail: true }));
    await waitFor(() => expect(lastText()).toBe("Longer."));

    expect(vi.mocked(streamAssist).mock.calls[1]?.[2]).toMatchObject({ hasMoreDetail: true });
    expect(exchange().turns.filter((turn) => turn.role === "model")).toEqual([
      { role: "model", text: "Longer." },
    ]);
  });

  it("marks an answer that came from Claude", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
      onUpdate(reply("From Claude.")),
    );
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
      onUpdate(reply("From Claude.")),
    );
    const { result, exchange } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    act(() => result.current.rerun(exchange(), { shouldEscalate: true }));
    await waitFor(() => expect(result.current.exchanges[0]?.turns.at(-1)?.isFromClaude).toBe(true));
  });

  it("refuses to follow up or re-ask on an exchange asked on an older commit", async () => {
    vi.mocked(streamAssist).mockImplementationOnce(async (_ref, _sha, _request, onUpdate) =>
      onUpdate(reply("Old.")),
    );
    const { result, rerender, exchange } = setup();

    act(() => result.current.start(TARGET, "explain"));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    rerender({ headSha: NEW_HEAD });
    act(() => result.current.followUp(exchange(), "Why?"));
    act(() => result.current.rerun(exchange(), {}));

    expect(streamAssist).toHaveBeenCalledTimes(1);
  });

  it("removes an exchange from the thread and from the session", () => {
    const saved: AssistThread[] = [
      {
        id: "6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f",
        headSha: HEAD,
        target: TARGET,
        action: "explain",
        question: null,
        turns: [{ role: "reviewer", text: "Explain this file" }],
      },
    ];
    const { result, store } = setup(HEAD, saved);
    act(() => result.current.remove("6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f"));
    expect(store.remove).toHaveBeenCalledWith("6f1c8f9e-1d2b-4c3a-9e8f-7a6b5c4d3e2f");
  });
});

describe("useAssist superseded streams", () => {
  it("ignores updates from a stream that a retry has replaced", async () => {
    let emitFirst: ((parsed: ParsedAssistStream) => void) | undefined;
    vi.mocked(streamAssist)
      .mockImplementationOnce((_ref, _sha, _request, onUpdate) => {
        emitFirst = onUpdate;
        return new Promise<void>(() => {});
      })
      .mockImplementationOnce(async (_ref, _sha, _request, onUpdate) => onUpdate(reply("fresh")));
    const { result, exchange, lastText } = setup();

    act(() => result.current.start(TARGET, "explain"));
    act(() => result.current.stop());
    act(() => result.current.rerun(exchange(), {}));
    await waitFor(() => expect(lastText()).toBe("fresh"));
    act(() => emitFirst?.(reply("stale")));

    expect(lastText()).toBe("fresh");
  });
});
