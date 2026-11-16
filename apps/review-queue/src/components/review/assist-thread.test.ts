import { describe, expect, it } from "vitest";
import { type AssistAction, type AssistTarget, MAX_HISTORY_TURNS } from "@/lib/assist-protocol";
import {
  canFollowUp,
  exchangeToContinue,
  openThread as openThreadAt,
  threadRequest,
  withEnding,
  withFollowUp,
  withModelText,
  withoutLastModelTurn,
} from "./assist-thread";

const HEAD = "a".repeat(40);
const RANGE = { path: "src/a.ts", from: { hunk: 0, line: 0 }, to: { hunk: 0, line: 2 } };
const LINES = { kind: "lines" as const, range: RANGE };
const WHOLE_FILE = { kind: "file" as const, path: "src/a.ts" };
const CHECK_TARGET = { kind: "check" as const, stepId: "s1", check: 0, path: "src/a.ts" };

function openThread(target: AssistTarget, action: AssistAction, question?: string) {
  return openThreadAt(target, action, HEAD, question ?? null);
}

describe("openThread", () => {
  it("starts explain right away with the action as the reviewer's turn", () => {
    const thread = openThread(LINES, "explain");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Explain these lines" }]);
    expect(threadRequest(thread)).toEqual({
      action: "explain",
      target: LINES,
      question: null,
      history: [],
    });
  });

  it("starts a comment draft right away, with no question", () => {
    const thread = openThread(LINES, "comment");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Draft a review comment" }]);
    expect(threadRequest(thread).question).toBeNull();
  });

  it("starts a flag check right away", () => {
    const thread = openThread(LINES, "check");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Check the flag on these lines" }]);
  });

  it("gives each exchange its own id and the commit it was asked on", () => {
    const first = openThread(LINES, "explain");
    expect(first.headSha).toBe(HEAD);
    expect(first.id).not.toBe(openThread(LINES, "explain").id);
  });

  it("asks about a whole file", () => {
    const thread = openThread(WHOLE_FILE, "explain");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Explain this file" }]);
    expect(threadRequest(thread).target).toEqual(WHOLE_FILE);
  });

  it("sends a question as the first turn and as the question, with no history", () => {
    const thread = openThread(LINES, "ask", "Why three?");
    expect(thread.turns).toEqual([{ role: "reviewer", text: "Why three?" }]);
    expect(threadRequest(thread)).toMatchObject({
      action: "ask",
      question: "Why three?",
      history: [],
    });
  });

  it("names a step check's question as the first turn too", () => {
    const thread = openThread(CHECK_TARGET, "explain", "Tell me more: Is eviction bounded?");
    expect(thread.turns).toEqual([
      { role: "reviewer", text: "Tell me more: Is eviction bounded?" },
    ]);
    expect(threadRequest(thread).history).toEqual([]);
  });
});

describe("follow-ups", () => {
  it("send the conversation after the first turn as history", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.");
    const thread = withFollowUp(answered, "Why?");
    expect(threadRequest(thread).history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("keep lookups on the model's turn but never send them back as history", () => {
    const lookup = { tool: "find_references", label: "Callers of `a` (1)", paths: ["src/b.ts"] };
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.", {
      lookups: [lookup],
    });
    expect(answered.turns.at(-1)).toEqual({ role: "model", text: "It sets a.", lookups: [lookup] });
    const thread = withFollowUp(answered, "Why?");
    expect(threadRequest(thread).history).toEqual([
      { role: "assistant", content: "It sets a." },
      { role: "user", content: "Why?" },
    ]);
  });

  it("replace the model's turn as more text streams in", () => {
    const first = withModelText(openThread(LINES, "explain"), "It");
    expect(withModelText(first, "It sets a.").turns.at(-1)).toEqual({
      role: "model",
      text: "It sets a.",
    });
  });

  it("stop before the history would be too long for the server", () => {
    let thread = withModelText(openThread(LINES, "explain"), "a");
    let longest = 0;
    while (canFollowUp(thread)) {
      const asked = withFollowUp(thread, "more?");
      longest = threadRequest(asked).history.length;
      thread = withModelText(asked, "a");
    }
    expect(longest).toBe(MAX_HISTORY_TURNS);
  });

  it("keeps the marks of a model turn: the lookup budget used up, and an answer from Claude", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.", {
      hasBudgetEnded: true,
      isFromClaude: true,
    });
    expect(answered.turns.at(-1)).toEqual({
      role: "model",
      text: "It sets a.",
      hasBudgetEnded: true,
      isFromClaude: true,
    });
  });
});

describe("re-asking", () => {
  it("drops the model's last answer so the re-ask replaces it", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.");
    expect(withoutLastModelTurn(answered).turns).toEqual([
      { role: "reviewer", text: "Explain these lines" },
    ]);
  });

  it("sends the options a re-ask asks for, and nothing else", () => {
    const thread = openThread(LINES, "explain");
    expect(threadRequest(thread, { hasMoreDetail: true, lookupBudget: 12 })).toEqual({
      action: "explain",
      target: LINES,
      question: null,
      history: [],
      hasMoreDetail: true,
      lookupBudget: 12,
    });
  });

  it("marks an answer that ended early, and keeps its partial text", () => {
    const partial = withEnding(withModelText(openThread(LINES, "explain"), "It sets"), "failed");
    expect(partial.turns.at(-1)).toEqual({ role: "model", text: "It sets", ended: "failed" });
  });
});

describe("exchangeToContinue", () => {
  it("continues the latest exchange only when it is about the same target on the same commit", () => {
    const answered = withModelText(openThread(LINES, "explain"), "It sets a.");
    expect(exchangeToContinue([answered], LINES, HEAD)).toBe(answered);
    expect(exchangeToContinue([answered], WHOLE_FILE, HEAD)).toBeNull();
    expect(exchangeToContinue([answered], LINES, "b".repeat(40))).toBeNull();
  });

  it("does not continue an exchange that is still waiting for its answer", () => {
    const asked = openThread(LINES, "ask", "Why three?");
    expect(exchangeToContinue([asked], LINES, HEAD)).toBeNull();
  });

  it("continues only the latest exchange, not an earlier one with the same target", () => {
    const earlier = withModelText(openThread(LINES, "explain"), "First.");
    const later = withModelText(openThread(WHOLE_FILE, "explain"), "Second.");
    expect(exchangeToContinue([earlier, later], LINES, HEAD)).toBeNull();
  });
});

describe("labels", () => {
  it("name a step check", () => {
    expect(openThread(CHECK_TARGET, "explain").turns[0].text).toBe("Explain this check");
    expect(openThread(CHECK_TARGET, "ask").turns[0].text).toBe("Ask about this check");
  });

  it("name lines or a whole file", () => {
    expect(openThread(LINES, "simplify").turns[0].text).toBe("Simplify these lines");
    expect(openThread(WHOLE_FILE, "simplify").turns[0].text).toBe("Simplify this file");
    expect(openThread(WHOLE_FILE, "review").turns[0].text).toBe("Review this file");
  });
});
