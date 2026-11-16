import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { ClaudeLauncher, ClaudeProcess } from "./claude-code";
import {
  askModel,
  fencedTitle,
  llmConfigFromEnv,
  LlmFailure,
  type Message,
  streamModel,
  streamTurn,
  type TurnEvent,
} from "./client";
import { COLD_LOAD_SECONDS, readMeasuredSpeeds } from "./speeds";

const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  backend: "local" as const,
  thinking: true,
  timeoutMs: 1000,
  problem: null,
};

function recordingFetch() {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      sseEvent("content_block_delta", { delta: { type: "text_delta", text: "ok" } }) +
        sseEvent("message_stop", {}),
    );
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

describe("llmConfigFromEnv", () => {
  it("defaults to local Ollama with no model chosen, and can be switched off", () => {
    expect(llmConfigFromEnv({})).toMatchObject({
      baseURL: "http://localhost:11434",
      model: "",
      enabled: true,
      backend: "local" as const,
      thinking: "model",
    });
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM: "off" }).enabled).toBe(false);
  });

  it("lets thinking follow the model, or be switched on or off", () => {
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM_THINKING: "off" }).thinking).toBe("off");
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM_THINKING: "on" }).thinking).toBe("on");
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM_THINKING: "maybe" }).thinking).toBe("model");
  });
});

describe("askModel", () => {
  it("sends the request's system prompt, token cap with room to think, and messages", async () => {
    const { fetchImpl, bodies } = recordingFetch();
    const reply = await askModel(
      { config: CONFIG, fetchImpl },
      { system: "sys", maxTokens: 42, messages: [{ role: "user", content: "hi" }] },
    );
    expect(reply).toBe("ok");
    expect(bodies[0]).toMatchObject({
      model: "m",
      system: "sys",
      max_tokens: 42 + 2048,
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
      stream: true,
    });
    expect(bodies[0]).not.toHaveProperty("thinking");
  });

  it("asks the model not to think, without the extra tokens, when thinking is off", async () => {
    const { fetchImpl, bodies } = recordingFetch();
    await askModel(
      { config: { ...CONFIG, thinking: false }, fetchImpl },
      { system: "sys", maxTokens: 42, messages: [{ role: "user", content: "hi" }] },
    );
    expect(bodies[0]).toMatchObject({ max_tokens: 42, thinking: { type: "disabled" } });
  });

  it("waits past the timeout once the answer has started", async () => {
    const config = { ...CONFIG, timeoutMs: 20 };
    const reply = await askModel({ config, fetchImpl: slowAnswerFetch(10) }, REQUEST);
    expect(reply).toBe("ab");
  });

  it("sends one request at a time, so a queued request's timeout starts when it is sent", async () => {
    const config = { ...CONFIG, timeoutMs: 20 };
    const fetchImpl = singleSlotFetch(10);
    const replies = await Promise.all([
      askModel({ config, fetchImpl }, REQUEST),
      askModel({ config, fetchImpl }, REQUEST),
    ]);
    expect(replies).toEqual(["ab", "ab"]);
  });

  it("fails when the model goes quiet for the timeout after it started answering", async () => {
    const config = { ...CONFIG, timeoutMs: 20 };
    await expect(
      askModel({ config, fetchImpl: silentAfterFirstByteFetch() }, REQUEST),
    ).rejects.toThrow(/stopped answering/);
  });

  it("lets an aborted caller leave the queue without holding the next one up", async () => {
    const config = { ...CONFIG, timeoutMs: 200 };
    const fetchImpl = singleSlotFetch(30);
    const first = askModel({ config, fetchImpl }, REQUEST);
    const controller = new AbortController();
    const second = askModel({ config, fetchImpl }, REQUEST, controller.signal);
    const third = askModel({ config, fetchImpl }, REQUEST);
    controller.abort(new DOMException("left", "AbortError"));
    await expect(second).rejects.toThrow("left");
    expect(await Promise.all([first, third])).toEqual(["ab", "ab"]);
  });

  it("sends a background call again after an interactive call preempted it", async () => {
    const systems: string[] = [];
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const system = JSON.parse(String(init?.body)).system as string;
      systems.push(system);
      if (system === "background" && systems.length === 1) {
        return new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
      }
      return new Response(
        sseEvent("content_block_delta", { delta: { type: "text_delta", text: system } }) +
          sseEvent("message_stop", {}),
      );
    }) as typeof fetch;
    const background = askModel(
      { config: CONFIG, fetchImpl },
      { ...REQUEST, system: "background" },
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const interactive = askModel(
      { config: CONFIG, fetchImpl },
      { ...REQUEST, system: "interactive" },
      undefined,
      "interactive",
    );
    expect(await interactive).toBe("interactive");
    expect(await background).toBe("background");
    expect(systems).toEqual(["background", "interactive", "background"]);
  });

  it("refuses a turn whose config names a problem, without sending anything", async () => {
    const fetchImpl = (async () => {
      throw new Error("must not be sent");
    }) as typeof fetch;
    const config = { ...CONFIG, problem: "Start one with `cl serve 9b`." };
    await expect(askModel({ config, fetchImpl }, REQUEST)).rejects.toThrow("cl serve 9b");
  });

  it("records the speed of a real turn from its usage events", async () => {
    const { fetchImpl } = streamingFetch([
      sseEvent("message_start", { message: { usage: { input_tokens: 500 } } }),
      sseEvent("content_block_start", { content_block: { type: "text" } }),
      sseEvent("message_delta", { usage: { output_tokens: 20 } }),
      sseEvent("message_stop", {}),
    ]);
    await askModel(
      { config: CONFIG, fetchImpl },
      { ...REQUEST, messages: [{ role: "user", content: "warm the model up" }] },
    );
    await askModel(
      { config: CONFIG, fetchImpl },
      { ...REQUEST, messages: [{ role: "user", content: "a turn no earlier test sent" }] },
    );
    expect(readMeasuredSpeeds().reading.isMeasured).toBe(true);
    expect(readMeasuredSpeeds().writing.isMeasured).toBe(true);
  });

  it("fails when the stream ends before message_stop", async () => {
    const { fetchImpl } = streamingFetch([
      sseEvent("content_block_delta", { delta: { type: "text_delta", text: "half" } }),
    ]);
    await expect(askModel({ config: CONFIG, fetchImpl }, REQUEST)).rejects.toThrow(/ended early/);
  });
});

function sseEvent(type: string, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
}

function textAnswer(text: string): string {
  return (
    sseEvent("content_block_delta", { delta: { type: "text_delta", text } }) +
    sseEvent("message_stop", {})
  );
}

function streamingFetch(chunks: string[]) {
  const bodies: unknown[] = [];
  const fetchImpl = async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return { fetchImpl: fetchImpl as typeof fetch, bodies };
}

function slowAnswerBody(
  delayMs: number,
  signal: AbortSignal | null | undefined,
  onAnswered: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const delta = (text: string) =>
    encoder.encode(sseEvent("content_block_delta", { delta: { type: "text_delta", text } }));
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(delta("a"));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      onAnswered();
      if (signal?.aborted) return controller.error(signal.reason);
      controller.enqueue(delta("b"));
      controller.enqueue(encoder.encode(sseEvent("message_stop", {})));
      controller.close();
    },
  });
}

function slowAnswerFetch(delayMs: number): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) =>
    new Response(slowAnswerBody(delayMs, init?.signal, () => {}))) as unknown as typeof fetch;
}

function silentAfterFirstByteFetch(): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            sseEvent("content_block_delta", { delta: { type: "text_delta", text: "a" } }),
          ),
        );
        init?.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
      },
    });
    return new Response(body);
  }) as unknown as typeof fetch;
}

function abortRejection(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_resolve, reject) =>
    signal?.addEventListener("abort", () => reject(signal.reason)),
  );
}

function singleSlotFetch(answerMs: number): typeof fetch {
  let slotFree: Promise<void> = Promise.resolve();
  return (async (_url: unknown, init?: RequestInit) => {
    const previous = slotFree;
    let freeSlot = () => {};
    slotFree = new Promise<void>((resolve) => (freeSlot = resolve));
    await Promise.race([previous, abortRejection(init?.signal)]).catch((reason: unknown) => {
      freeSlot();
      throw reason;
    });
    return new Response(slowAnswerBody(answerMs, init?.signal, freeSlot));
  }) as unknown as typeof fetch;
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const parts: T[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
}

async function collectTurn(stream: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  return (await collect(stream)).filter((event) => event.type !== "phase");
}

const REQUEST = {
  system: "sys",
  maxTokens: 10,
  messages: [{ role: "user" as const, content: "hi" }],
};

describe("streamModel", () => {
  it("yields text deltas, even when events are split across chunks", async () => {
    const events =
      sseEvent("message_start", { message: {} }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Hel" } }) +
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "lo" } }) +
      sseEvent("message_stop", {});
    const { fetchImpl, bodies } = streamingFetch([events.slice(0, 70), events.slice(70)]);
    const parts = await collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST));
    expect(parts.join("")).toBe("Hello");
    expect(bodies[0]).toMatchObject({ stream: true, system: "sys", max_tokens: 10 + 2048 });
  });

  it("drops the model's thinking and yields only its answer", async () => {
    const events =
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "thinking_delta", thinking: "Draft" },
      }) +
      sseEvent("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Answer" } }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const parts = await collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST));
    expect(parts.join("")).toBe("Answer");
  });

  it("gives up when the model does not start answering in time", async () => {
    const hanging = (async (_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      )) as unknown as typeof fetch;
    const config = { ...CONFIG, timeoutMs: 20 };
    await expect(collect(streamModel({ config, fetchImpl: hanging }, REQUEST))).rejects.toThrow(
      /timeout|too long/i,
    );
  });

  it("keeps streaming past the timeout once the answer has started", async () => {
    const config = { ...CONFIG, timeoutMs: 20 };
    const parts = await collect(streamModel({ config, fetchImpl: slowAnswerFetch(10) }, REQUEST));
    expect(parts.join("")).toBe("ab");
  });

  it("reports a missing model", async () => {
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      'Model "m" is not installed',
    );
  });

  it("raises an error event from the server", async () => {
    const { fetchImpl } = streamingFetch([sseEvent("error", { error: { message: "overloaded" } })]);
    await expect(collect(streamModel({ config: CONFIG, fetchImpl }, REQUEST))).rejects.toThrow(
      "overloaded",
    );
  });
});

describe("streamTurn", () => {
  it("reports a turn that waits for the lane as queued, with how many turns are ahead", async () => {
    const { fetchImpl } = streamingFetch([textAnswer("first")]);
    const first = streamTurn({ config: CONFIG, fetchImpl }, REQUEST, undefined, "background");
    const second = streamTurn({ config: CONFIG, fetchImpl }, REQUEST, undefined, "background");
    try {
      expect(await first.next()).toMatchObject({
        value: { type: "phase", phase: { phase: "reading" } },
      });
      expect(await second.next()).toEqual({
        done: false,
        value: { type: "phase", phase: { phase: "queued", ahead: 1 } },
      });
    } finally {
      await first.return(undefined);
      await second.return(undefined);
    }
  });

  it("adds the model load to the reading time when no turn has run for five minutes", async () => {
    const idleSince = Date.now() + 10 * 60_000;
    vi.spyOn(Date, "now").mockReturnValue(idleSince);
    try {
      const { fetchImpl } = streamingFetch([textAnswer("asleep")]);
      const phases = await collect(
        streamTurn({ config: CONFIG, fetchImpl }, { ...REQUEST, system: "cold system" }),
      );
      const reading = phases.find(
        (event) => event.type === "phase" && event.phase.phase === "reading",
      );
      expect(reading).toMatchObject({
        phase: { phase: "reading", seconds: expect.any(Number) },
      });
      expect(
        reading?.type === "phase" && reading.phase.phase === "reading" && reading.phase.seconds,
      ).toBeGreaterThanOrEqual(COLD_LOAD_SECONDS);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("estimates a follow-up from the part of its prompt the server has not seen", async () => {
    const earlier = { role: "user" as const, content: "x".repeat(40_000) };
    const readingSeconds = async (messages: Message[]) => {
      const { fetchImpl } = streamingFetch([textAnswer("ok")]);
      const phases = await collect(
        streamTurn(
          { config: { ...CONFIG, baseURL: "http://reuse.test" }, fetchImpl },
          { ...REQUEST, system: "reuse system", messages },
        ),
      );
      return phases.flatMap((event) =>
        event.type === "phase" && event.phase.phase === "reading" ? [event.phase.seconds] : [],
      )[0];
    };
    const first = await readingSeconds([earlier]);
    const followUp = await readingSeconds([
      earlier,
      { role: "assistant", content: "ok" },
      { role: "user", content: "and why?" },
    ]);
    expect(followUp).toBeLessThan(first);
  });

  it("refuses to send when the server is not usable, saying why", async () => {
    const fetchImpl = (async () => {
      throw new Error("fetch must not be called");
    }) as typeof fetch;
    const config = { ...CONFIG, problem: "Start one with `cl serve 9b`" };
    const failure = collect(streamTurn({ config, fetchImpl }, REQUEST));
    await expect(failure).rejects.toMatchObject({
      kind: "unavailable",
      message: "Start one with `cl serve 9b`",
    });
  });

  it("says the server is not answering when the connection is refused", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const failure = collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    await expect(failure).rejects.toThrow("The model server at http://llm.test is not answering");
    await expect(
      collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST)),
    ).rejects.toBeInstanceOf(LlmFailure);
  });

  it("tags a stream that ends before message_stop as ended early", async () => {
    const { fetchImpl } = streamingFetch([
      sseEvent("content_block_delta", { delta: { type: "text_delta", text: "Half" } }),
    ]);
    const failure = collect(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    await expect(failure).rejects.toMatchObject({ kind: "ended-early" });
  });

  it("yields a tool_use block whose input arrives in split JSON chunks", async () => {
    const events =
      sseEvent("content_block_start", {
        index: 0,
        content_block: { type: "tool_use", id: "t1", name: "find_references", input: {} },
      }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"name":' },
      }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "input_json_delta", partial_json: '"loadReview"}' },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collectTurn(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([
      { type: "tool_use", id: "t1", name: "find_references", input: { name: "loadReview" } },
    ]);
  });

  it("yields text and tool calls in stream order", async () => {
    const events =
      sseEvent("content_block_start", { index: 0, content_block: { type: "text" } }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "text_delta", text: "Let me look." },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("content_block_start", {
        index: 1,
        content_block: { type: "tool_use", id: "t2", name: "read_file", input: {} },
      }) +
      sseEvent("content_block_delta", {
        index: 1,
        delta: { type: "input_json_delta", partial_json: '{"path":"src/a.ts"}' },
      }) +
      sseEvent("content_block_stop", { index: 1 }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collectTurn(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "t2", name: "read_file", input: { path: "src/a.ts" } },
    ]);
  });

  it("ignores thinking blocks and their deltas", async () => {
    const events =
      sseEvent("content_block_start", { index: 0, content_block: { type: "thinking" } }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "thinking_delta", thinking: "Draft" },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Answer" } }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collectTurn(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([{ type: "text", text: "Answer" }]);
  });

  it("sends tools in the request body only when the request sets them", async () => {
    const tools = [
      {
        name: "find_references",
        description: "List uses of a name.",
        input_schema: { type: "object", properties: {} },
      },
    ];
    const withTools = streamingFetch([sseEvent("message_stop", {})]);
    await collect(
      streamTurn({ config: CONFIG, fetchImpl: withTools.fetchImpl }, { ...REQUEST, tools }),
    );
    expect(withTools.bodies[0]).toMatchObject({ tools });

    const withoutTools = streamingFetch([sseEvent("message_stop", {})]);
    await collectTurn(streamTurn({ config: CONFIG, fetchImpl: withoutTools.fetchImpl }, REQUEST));
    expect(withoutTools.bodies[0]).not.toHaveProperty("tools");
  });

  it("yields a tool_use with the unparseable input kept aside instead of throwing", async () => {
    const events =
      sseEvent("content_block_start", {
        index: 0,
        content_block: { type: "tool_use", id: "t3", name: "find_references", input: {} },
      }) +
      sseEvent("content_block_delta", {
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"name":' },
      }) +
      sseEvent("content_block_stop", { index: 0 }) +
      sseEvent("message_stop", {});
    const { fetchImpl } = streamingFetch([events]);
    const turn = await collectTurn(streamTurn({ config: CONFIG, fetchImpl }, REQUEST));
    expect(turn).toEqual([
      {
        type: "tool_use",
        id: "t3",
        name: "find_references",
        input: { invalid_json: '{"name":' },
      },
    ]);
  });
});

type FakeClaudeOptions = { exitCode?: number; stderr?: string; stayOpen?: boolean };

function frame(event: object): string {
  return `${JSON.stringify({ type: "stream_event", event })}\n`;
}

function textFrame(text: string): string {
  return frame({ type: "content_block_delta", delta: { type: "text_delta", text } });
}

const STOP_FRAME = frame({ type: "message_stop" });

function fakeClaude(lines: string[], options: FakeClaudeOptions = {}) {
  const launches: { model: string; maxTokens: number; thinking: boolean }[] = [];
  const kills: string[] = [];
  const launchClaude: ClaudeLauncher = (model, request, thinking) => {
    launches.push({ model, maxTokens: request.maxTokens, thinking });
    const emitter = new EventEmitter();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const closeProcess = () => {
      stdout.end();
      emitter.emit("close", options.exitCode ?? 0);
    };
    const child = Object.assign(emitter, {
      stdin: new PassThrough(),
      stdout,
      stderr,
      kill: () => {
        kills.push("killed");
        closeProcess();
        return true;
      },
    });
    for (const line of lines) stdout.write(line);
    if (options.stderr) stderr.write(options.stderr);
    if (!options.stayOpen) setImmediate(closeProcess);
    return child as unknown as ClaudeProcess;
  };
  return { launchClaude, launches, kills };
}

const CLAUDE_CONFIG = { ...CONFIG, backend: "claude-code" as const, model: "haiku" };

function launchFailingWith(failure: Error): ClaudeLauncher {
  return () => {
    const emitter = new EventEmitter();
    const stdout = new PassThrough();
    setImmediate(() => {
      emitter.emit("error", failure);
      stdout.end();
    });
    return Object.assign(emitter, {
      stdin: new PassThrough(),
      stdout,
      stderr: new PassThrough(),
      kill: () => true,
    }) as unknown as ClaudeProcess;
  };
}

describe("streamTurn on Claude Code", () => {
  it("yields the text of the streamed events and never calls fetch", async () => {
    const { launchClaude, launches } = fakeClaude([
      `${JSON.stringify({ type: "system", subtype: "init" })}\n`,
      textFrame("Hel"),
      textFrame("lo"),
      STOP_FRAME,
      `${JSON.stringify({ type: "result", is_error: false, result: "Hello" })}\n`,
    ]);
    const fetchImpl = (async () => {
      throw new Error("fetch must not be called");
    }) as typeof fetch;
    const parts = await collect(
      streamModel({ config: CLAUDE_CONFIG, fetchImpl, launchClaude }, REQUEST),
    );
    expect(parts.join("")).toBe("Hello");
    expect(launches).toEqual([{ model: "haiku", maxTokens: 10 + 2048, thinking: true }]);
  });

  it("gives the model no room to think when thinking is off", async () => {
    const { launchClaude, launches } = fakeClaude([textFrame("ok"), STOP_FRAME]);
    const config = { ...CLAUDE_CONFIG, thinking: false };
    await collect(streamModel({ config, fetchImpl: fetch, launchClaude }, REQUEST));
    expect(launches).toEqual([{ model: "haiku", maxTokens: 10, thinking: false }]);
  });

  it("handles a line split across chunks and thinking events", async () => {
    const whole =
      frame({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hm" } }) +
      textFrame("Answer") +
      STOP_FRAME;
    const { launchClaude } = fakeClaude([whole.slice(0, 40), whole.slice(40)]);
    const parts = await collect(
      streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST),
    );
    expect(parts.join("")).toBe("Answer");
  });

  it("fails when the output ends before message_stop", async () => {
    const { launchClaude } = fakeClaude([textFrame("half")]);
    await expect(
      collect(streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow(/ended early/);
  });

  it("reports what Claude Code wrote to stderr when it exits with an error", async () => {
    const { launchClaude } = fakeClaude([], { exitCode: 1, stderr: "Not logged in" });
    await expect(
      collect(streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow(/Not logged in/);
  });

  it("raises the message of a failed result", async () => {
    const failure = JSON.stringify({ type: "result", is_error: true, result: "Out of credit" });
    const { launchClaude } = fakeClaude([`${failure}\n`], { exitCode: 1 });
    await expect(
      collect(streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow("Out of credit");
  });

  it("says Claude Code is missing when the binary cannot be found", async () => {
    const launchClaude = launchFailingWith(
      Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }),
    );
    await expect(
      collect(streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow(/Claude Code was not found.*REVIEW_QUEUE_CLAUDE_BIN/);
  });

  it("keeps the message of other spawn failures", async () => {
    const launchClaude = launchFailingWith(
      Object.assign(new Error("spawn claude EACCES"), { code: "EACCES" }),
    );
    await expect(
      collect(streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow("spawn claude EACCES");
  });

  it("kills Claude Code when the reader aborts", async () => {
    const { launchClaude, kills } = fakeClaude([textFrame("a")], { stayOpen: true });
    const controller = new AbortController();
    const reading = collect(
      streamModel(
        { config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude },
        REQUEST,
        controller.signal,
      ),
    );
    setTimeout(() => controller.abort(new DOMException("left", "AbortError")), 10);
    await expect(reading).rejects.toThrow("left");
    expect(kills).toHaveLength(1);
  });

  it("kills Claude Code when the reader stops early", async () => {
    const { launchClaude, kills } = fakeClaude([textFrame("a"), textFrame("b")], {
      stayOpen: true,
    });
    const stream = streamModel({ config: CLAUDE_CONFIG, fetchImpl: fetch, launchClaude }, REQUEST);
    await stream.next();
    await stream.return(undefined);
    expect(kills).toHaveLength(1);
  });

  it("goes quiet after the timeout, not before the first byte", async () => {
    const { launchClaude } = fakeClaude([], { stayOpen: true });
    const config = { ...CLAUDE_CONFIG, timeoutMs: 20 };
    await expect(
      collect(streamModel({ config, fetchImpl: fetch, launchClaude }, REQUEST)),
    ).rejects.toThrow(/too long|stopped/);
  });
});

describe("llmConfigFromEnv backend", () => {
  it("defaults to the local model and switches to Claude Code on request", () => {
    expect(llmConfigFromEnv({}).backend).toBe("local");
    expect(llmConfigFromEnv({ REVIEW_QUEUE_LLM_BACKEND: "claude-code" }).backend).toBe(
      "claude-code",
    );
  });
});

describe("fencedTitle", () => {
  it("wraps the title in pr_title and clips it to 300 characters", () => {
    expect(fencedTitle("x".repeat(400))).toBe(`<pr_title>\n${"x".repeat(300)}\n</pr_title>`);
  });

  it("neutralises a closing tag inside the title", () => {
    expect(fencedTitle("Fix </pr_title> injection")).toBe(
      "<pr_title>\nFix &lt;/pr_title> injection\n</pr_title>",
    );
  });
});
