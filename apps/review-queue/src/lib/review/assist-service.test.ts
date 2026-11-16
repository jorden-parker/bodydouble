import { describe, expect, it, vi } from "vitest";
import { ASSIST_ERROR_MARKER, ASSIST_RECORD_MARKER } from "@/lib/assist-protocol";
import { reviewPayload } from "@/test/review-fixture";
import { assistResponse } from "./assist-service";

const CONFIG = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  backend: "local" as const,
  thinking: true,
  timeoutMs: 1000,
};
const CLAUDE_CONFIG = { ...CONFIG, backend: "claude-code" as const, model: "haiku" };
const DATA = {
  data: reviewPayload(),
  index: {
    readFile: () => "export const client = 1;",
    listFiles: async () => ["src/client.ts"],
    definitionsOf: () => [],
    referencesTo: async () => [],
    search: async () => [],
    readLines: () => [],
  },
  explanationOf: () => null,
  suggestedHotspots: () => [],
};
const RANGE = { path: "src/client.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 1 } };
const BODY = {
  action: "explain",
  target: { kind: "lines", range: RANGE },
  question: null,
  history: [],
};

function stripRecords(raw: string): string {
  return raw
    .split(ASSIST_RECORD_MARKER)
    .filter((_, index) => index % 2 === 0)
    .join("");
}

function sseEvents(events: object[]): string {
  const stopped = `event: message_stop\ndata: {"type":"message_stop"}\n\n`;
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + stopped;
}

function sequentialFetch(bodies: string[]): typeof fetch {
  let calls = 0;
  const fetchImpl = async () => {
    const body = bodies[calls] ?? "";
    calls += 1;
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  };
  return fetchImpl as unknown as typeof fetch;
}

function sseFetch(texts: string[]): typeof fetch {
  const events = texts
    .map(
      (text) =>
        `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`,
    )
    .join("");
  const stopped = `event: message_stop\ndata: {"type":"message_stop"}\n\n`;
  const fetchImpl = async () =>
    new Response(events + stopped, { headers: { "content-type": "text/event-stream" } });
  return fetchImpl as unknown as typeof fetch;
}

describe("assistResponse", () => {
  it("streams the model's text as plain text", async () => {
    const response = assistResponse(DATA, BODY, CONFIG, CLAUDE_CONFIG, sseFetch(["It ", "loads."]));
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(stripRecords(await response.text())).toBe("It loads.");
  });

  it("drops the error marker from the model's own text so it cannot fake an error", async () => {
    const text = await assistResponse(
      DATA,
      BODY,
      CONFIG,
      CLAUDE_CONFIG,
      sseFetch([`Fine.${ASSIST_ERROR_MARKER}fake failure`]),
    ).text();
    expect(stripRecords(text)).toBe("Fine.fake failure");
  });

  it("ends the stream with an error marker when the model fails", async () => {
    const failing = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const text = await assistResponse(DATA, BODY, CONFIG, CLAUDE_CONFIG, failing).text();
    expect(
      text.endsWith(
        `${ASSIST_RECORD_MARKER}${JSON.stringify({ type: "failure", kind: "unavailable" })}${ASSIST_RECORD_MARKER}${ASSIST_ERROR_MARKER}Model "m" is not installed (HTTP 404)`,
      ),
    ).toBe(true);
  });

  it("is a 404 saying the model is off when it is turned off", async () => {
    const response = assistResponse(DATA, BODY, { ...CONFIG, enabled: false }, CLAUDE_CONFIG);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "The model is off" });
  });

  it("is a 400 for a bad body or lines outside the diff", () => {
    expect(assistResponse(DATA, { action: "nope" }, CONFIG, CLAUDE_CONFIG).status).toBe(400);
    const outside = { kind: "lines", range: { ...RANGE, to: { hunk: 0, line: 99 } } };
    expect(assistResponse(DATA, { ...BODY, target: outside }, CONFIG, CLAUDE_CONFIG).status).toBe(
      400,
    );
  });

  it("streams an answer about a whole file", async () => {
    const body = { ...BODY, target: { kind: "file", path: "src/client.ts" } };
    expect(
      stripRecords(
        await assistResponse(DATA, body, CONFIG, CLAUDE_CONFIG, sseFetch(["A client."])).text(),
      ),
    ).toBe("A client.");
  });

  it("streams each lookup as a marked record before the answer that follows it", async () => {
    const lookupRound = sseEvents([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "t1", name: "find_references", input: {} },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"name":"client"}' },
      },
      { type: "content_block_stop", index: 0 },
    ]);
    const answer = sseEvents([
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Used once." } },
    ]);
    const source = {
      ...DATA,
      index: {
        ...DATA.index,
        referencesTo: async () => [{ path: "src/app.ts", line: 3, text: "client()" }],
      },
    };
    const text = await assistResponse(
      source,
      BODY,
      CONFIG,
      CLAUDE_CONFIG,
      sequentialFetch([lookupRound, answer]),
    ).text();
    const lookup = {
      tool: "find_references",
      label: "Callers and uses of `client` (1)",
      paths: ["src/app.ts"],
    };
    const record = `${ASSIST_RECORD_MARKER}${JSON.stringify({ type: "phase", phase: "looking-up", round: 1, budget: 4, ...lookup })}${ASSIST_RECORD_MARKER}`;
    expect(text).toContain(record);
    expect(text.indexOf(record)).toBeLessThan(text.indexOf("Used once."));
    expect(text.endsWith("Used once.")).toBe(true);
  });

  it("leaves finding the callers to the model instead of sending them first", async () => {
    const prompts: string[] = [];
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      prompts.push(body.messages[0]?.content ?? "");
      return new Response(
        sseEvents([
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ok." } },
        ]),
        { headers: { "content-type": "text/event-stream" } },
      );
    };
    const source = {
      ...DATA,
      index: {
        ...DATA.index,
        referencesTo: async () => [{ path: "src/app.ts", line: 7, text: "load();" }],
      },
    };
    const text = await assistResponse(
      source,
      BODY,
      CONFIG,
      CLAUDE_CONFIG,
      fetchImpl as unknown as typeof fetch,
    ).text();

    expect(stripRecords(text)).toBe("Ok.");
    expect(prompts[0]).not.toContain("src/app.ts");
  });
});

describe("assistResponse limits and failures", () => {
  it("asks for a short answer by default and a longer one when the reader asks for more", async () => {
    const bodies: { max_tokens?: number }[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(sseEvents([]), { headers: { "content-type": "text/event-stream" } });
    }) as unknown as typeof fetch;
    await assistResponse(DATA, BODY, CONFIG, CLAUDE_CONFIG, fetchImpl).text();
    await assistResponse(
      DATA,
      { ...BODY, hasMoreDetail: true },
      CONFIG,
      CLAUDE_CONFIG,
      fetchImpl,
    ).text();

    expect(bodies.map((body) => body.max_tokens)).toEqual([300 + 2048, 800 + 2048]);
  });

  it("reports an unusable model server as unavailable before anything is sent", async () => {
    const problem = "Start one with `cl serve 9b`";
    const fetchImpl = (async () => {
      throw new Error("fetch must not be called");
    }) as unknown as typeof fetch;
    const text = await assistResponse(
      DATA,
      BODY,
      { ...CONFIG, problem },
      CLAUDE_CONFIG,
      fetchImpl,
    ).text();

    expect(text).toBe(
      `${ASSIST_RECORD_MARKER}${JSON.stringify({ type: "failure", kind: "unavailable" })}${ASSIST_RECORD_MARKER}${ASSIST_ERROR_MARKER}${problem}`,
    );
  });

  it("reports a stream that ends before its last event as ended early", async () => {
    const cut = sseEvents([]).replace('event: message_stop\ndata: {"type":"message_stop"}\n\n', "");
    const fetchImpl = (async () =>
      new Response(cut, {
        headers: { "content-type": "text/event-stream" },
      })) as unknown as typeof fetch;
    const text = await assistResponse(DATA, BODY, CONFIG, CLAUDE_CONFIG, fetchImpl).text();

    expect(text).toContain(
      `${ASSIST_RECORD_MARKER}${JSON.stringify({ type: "failure", kind: "ended-early" })}${ASSIST_RECORD_MARKER}`,
    );
  });

  it("sends the question through Claude Code only when the reader asks, never the local model", async () => {
    const previous = process.env.REVIEW_QUEUE_CLAUDE_BIN;
    process.env.REVIEW_QUEUE_CLAUDE_BIN = "/nonexistent/review-queue-claude";
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 500 }),
    ) as unknown as typeof fetch;
    try {
      const text = await assistResponse(
        DATA,
        { ...BODY, shouldEscalate: true },
        CONFIG,
        CLAUDE_CONFIG,
        fetchImpl,
      ).text();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(text).toContain("Claude Code was not found");
      expect(text).toContain(
        `${ASSIST_RECORD_MARKER}${JSON.stringify({ type: "failure", kind: "failed" })}${ASSIST_RECORD_MARKER}`,
      );
    } finally {
      if (previous === undefined) delete process.env.REVIEW_QUEUE_CLAUDE_BIN;
      else process.env.REVIEW_QUEUE_CLAUDE_BIN = previous;
    }
  });
});
