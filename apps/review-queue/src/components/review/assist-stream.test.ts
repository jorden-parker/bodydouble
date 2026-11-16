import { describe, expect, it } from "vitest";
import {
  ASSIST_ERROR_MARKER,
  ASSIST_RECORD_MARKER,
  type AssistLookup,
  type AssistPhase,
} from "@/lib/assist-protocol";
import { parseAssistStream } from "./assist-stream";

const LOOKUP: AssistLookup = {
  tool: "find_references",
  label: "Callers and uses of `loadReview` (2)",
  paths: ["src/app.ts"],
};

const record = (value: object) =>
  `${ASSIST_RECORD_MARKER}${JSON.stringify(value)}${ASSIST_RECORD_MARKER}`;

const lookupRecord = (lookup: AssistLookup) =>
  record({ type: "phase", phase: "looking-up", round: 1, budget: 4, ...lookup });

const EMPTY = { lookups: [], failure: null, phase: null, failureKind: null, hasBudgetEnded: false };

describe("parseAssistStream", () => {
  it("returns plain text when there are no lookups", () => {
    expect(parseAssistStream("It loads.")).toEqual({ text: "It loads.", ...EMPTY });
  });

  it("takes a lookup that comes before the text", () => {
    expect(parseAssistStream(`${lookupRecord(LOOKUP)}Only one caller.`)).toEqual({
      text: "Only one caller.",
      ...EMPTY,
      lookups: [LOOKUP],
      phase: { type: "phase", phase: "looking-up", round: 1, budget: 4, ...LOOKUP },
    });
  });

  it("takes a lookup between two pieces of text", () => {
    expect(parseAssistStream(`Checking ${lookupRecord(LOOKUP)}then answering.`)).toEqual({
      text: "Checking then answering.",
      ...EMPTY,
      lookups: [LOOKUP],
      phase: { type: "phase", phase: "looking-up", round: 1, budget: 4, ...LOOKUP },
    });
  });

  it("drops a lookup that has not finished arriving", () => {
    expect(parseAssistStream(`Answer ${ASSIST_RECORD_MARKER}{"tool":"find`)).toEqual({
      text: "Answer ",
      ...EMPTY,
    });
  });

  it("keeps the text and the failure apart when the stream fails", () => {
    expect(parseAssistStream(`Partial${ASSIST_ERROR_MARKER}Model is not installed`)).toEqual({
      text: "Partial",
      ...EMPTY,
      failure: "Model is not installed",
    });
  });

  it("drops a lookup whose JSON does not parse and carries on with the text", () => {
    expect(parseAssistStream(`Ok${ASSIST_RECORD_MARKER}{nope${ASSIST_RECORD_MARKER} then`)).toEqual(
      {
        text: "Ok then",
        ...EMPTY,
      },
    );
  });

  it("drops a lookup without a label", () => {
    const withoutLabel = record({
      type: "phase",
      phase: "looking-up",
      tool: "search_code",
      paths: [],
    });
    expect(parseAssistStream(`${withoutLabel}Done.`)).toEqual({ text: "Done.", ...EMPTY });
  });

  it("reports the latest phase, so the reader sees what is happening now", () => {
    const raw =
      record({ type: "phase", phase: "queued", ahead: 2 }) +
      record({
        type: "phase",
        phase: "reading",
        promptTokens: 900,
        seconds: 5.3,
        isEstimate: true,
      }) +
      record({
        type: "phase",
        phase: "writing",
        tokensPerSecond: 12.5,
        isMeasured: true,
        maxSeconds: 24,
      }) +
      "Answer";
    expect(parseAssistStream(raw)).toEqual({
      text: "Answer",
      ...EMPTY,
      phase: {
        type: "phase",
        phase: "writing",
        tokensPerSecond: 12.5,
        isMeasured: true,
        maxSeconds: 24,
      },
    });
  });

  it("reports the budget ending the search as the phase", () => {
    const phase: AssistPhase = { phase: "budget-ended", budget: 4 };
    expect(parseAssistStream(record({ type: "phase", ...phase }) + "Done.")).toMatchObject({
      phase,
      lookups: [],
      hasBudgetEnded: true,
    });
  });

  it("ignores a phase it does not know", () => {
    expect(parseAssistStream(record({ type: "phase", phase: "dreaming" }) + "Hi")).toEqual({
      text: "Hi",
      ...EMPTY,
    });
  });

  it("reports the kind of failure the server sent before the failure text", () => {
    const raw =
      "Partial" +
      record({ type: "failure", kind: "unavailable" }) +
      `${ASSIST_ERROR_MARKER}Start one with \`cl serve 9b\``;
    expect(parseAssistStream(raw)).toEqual({
      text: "Partial",
      ...EMPTY,
      failure: "Start one with `cl serve 9b`",
      failureKind: "unavailable",
    });
  });
});
