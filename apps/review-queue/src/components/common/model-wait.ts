import type { AssistPhase } from "@/lib/assist-protocol";

type WaitView = { label: string; detail: string; percent: number | null };

const NBSP = " ";
const SEPARATOR = `${NBSP}· `;

function count(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function seconds(value: number): string {
  return `${NBSP}${Math.max(0, Math.round(value))}${NBSP}s`;
}

function joined(parts: string[]): string {
  return parts.join(SEPARATOR);
}

function percentOf(elapsed: number, total: number): number {
  return Math.min(100, Math.round((elapsed / total) * 100));
}

function readingView(phase: Extract<AssistPhase, { phase: "reading" }>, elapsed: number): WaitView {
  const left = phase.seconds - elapsed;
  return {
    label: "Reading",
    detail: joined([`${count(phase.promptTokens)}${NBSP}tokens`, `about${seconds(left)}`]),
    percent: phase.seconds > 0 ? percentOf(elapsed, phase.seconds) : null,
  };
}

function writingView(phase: Extract<AssistPhase, { phase: "writing" }>, elapsed: number): WaitView {
  const guess = phase.isMeasured ? "" : ", a guess until measured";
  return {
    label: "Writing",
    detail: joined([
      `${count(phase.tokensPerSecond)}${NBSP}tokens/s${guess}`,
      `at most about${seconds(phase.maxSeconds - elapsed)}${NBSP}left`,
    ]),
    percent: percentOf(elapsed, phase.maxSeconds),
  };
}

function lookupView(phase: Extract<AssistPhase, { phase: "looking-up" }>): WaitView {
  return {
    label: "Looking up",
    detail: joined([
      phase.label.replaceAll("`", ""),
      `round${NBSP}${phase.round}${NBSP}of${NBSP}${phase.budget}`,
    ]),
    percent: Math.round((phase.round / phase.budget) * 100),
  };
}

export function waitView(phase: AssistPhase | null, elapsed: number): WaitView {
  if (phase === null)
    return { label: "Sending to the model", detail: "Waiting for its first word", percent: null };
  if (phase.phase === "queued")
    return {
      label: "Queued",
      detail: `Behind ${phase.ahead}${NBSP}${phase.ahead === 1 ? "turn" : "turns"}`,
      percent: null,
    };
  if (phase.phase === "reading") return readingView(phase, elapsed);
  if (phase.phase === "looking-up") return lookupView(phase);
  if (phase.phase === "writing") return writingView(phase, elapsed);
  return {
    label: "Lookups done",
    detail: `All ${phase.budget}${NBSP}lookups used, writing the answer`,
    percent: null,
  };
}
