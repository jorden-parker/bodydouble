import { describe, expect, it } from "vitest";
import type { AssistThread } from "@/lib/assist-protocol";
import { emptySession, HEAD_SHA } from "@/test/review-fixture";
import { withExchange, withoutExchange } from "./exchanges";

function thread(id: string, text = "It loads."): AssistThread {
  return {
    id,
    headSha: HEAD_SHA,
    target: { kind: "file", path: "src/a.ts" },
    action: "explain",
    question: null,
    turns: [
      { role: "reviewer", text: "Explain this file" },
      { role: "model", text },
    ],
  };
}

const NOW = "2026-10-26T10:00:00.000Z";

describe("withExchange", () => {
  it("adds a new exchange after the ones already asked", () => {
    const session = withExchange(emptySession(), thread("t1"), NOW);
    const next = withExchange(session, thread("t2"), NOW);
    expect(next.assistThreads.map((exchange) => exchange.id)).toEqual(["t1", "t2"]);
    expect(next.assistThreads[1].updatedAt).toBe(NOW);
  });

  it("updates an exchange in place, without moving it", () => {
    let session = withExchange(emptySession(), thread("t1"), NOW);
    session = withExchange(session, thread("t2"), NOW);
    session = withExchange(session, thread("t1", "It loads twice."), NOW);
    expect(session.assistThreads.map((exchange) => exchange.id)).toEqual(["t1", "t2"]);
    expect(session.assistThreads[0].turns[1].text).toBe("It loads twice.");
  });
});

describe("withoutExchange", () => {
  it("drops the exchange", () => {
    const session = withExchange(emptySession(), thread("t1"), NOW);
    expect(withoutExchange(session, "t1").assistThreads).toEqual([]);
  });
});
