import type { DiffLine, Hunk } from "@/lib/types";

export const ASSIST_ACTIONS = ["explain", "simplify", "comment", "ask", "check", "review"] as const;

export type AssistAction = (typeof ASSIST_ACTIONS)[number];

export const ASSIST_ERROR_MARKER = "\u0000";

export const ASSIST_RECORD_MARKER = "\u0001";

export type AssistLookup = { tool: string; label: string; paths: string[] };

export type AssistFailureKind = "unavailable" | "ended-early" | "failed";

export type AssistPhase =
  | { phase: "queued"; ahead: number }
  | { phase: "reading"; promptTokens: number; seconds: number; isEstimate: boolean }
  | ({ phase: "looking-up"; round: number; budget: number } & AssistLookup)
  | { phase: "writing"; tokensPerSecond: number; isMeasured: boolean; maxSeconds: number }
  | { phase: "budget-ended"; budget: number };

export type AssistRecord =
  ({ type: "phase" } & AssistPhase) | { type: "failure"; kind: AssistFailureKind };

export const DEFAULT_LOOKUP_BUDGET = 4;

export const MAX_LOOKUP_BUDGET = 12;

export const MAX_HISTORY_TURNS = 10;

export type LinePosition = { hunk: number; line: number };

export type LineRange = { path: string; from: LinePosition; to: LinePosition };

type StepCheckTarget = { kind: "check"; stepId: string; check: number; path: string };

export type AssistTarget =
  { kind: "lines"; range: LineRange } | { kind: "file"; path: string } | StepCheckTarget;

export type AssistTurn = {
  role: "reviewer" | "model";
  text: string;
  lookups?: AssistLookup[];
  ended?: "stopped" | "failed";
  hasBudgetEnded?: boolean;
  isFromClaude?: boolean;
};

export type AssistThread = {
  id: string;
  headSha: string;
  target: AssistTarget;
  action: AssistAction;
  question: string | null;
  turns: AssistTurn[];
};

export type SavedAssistThread = AssistThread & { updatedAt: string };

type FileLine = LinePosition & { path: string };

export function isBefore(a: LinePosition, b: LinePosition): boolean {
  return a.hunk < b.hunk || (a.hunk === b.hunk && a.line < b.line);
}

export function orderedRange(anchor: FileLine, focus: FileLine): LineRange | null {
  if (anchor.path !== focus.path) return null;
  const [first, last] = isBefore(focus, anchor) ? [focus, anchor] : [anchor, focus];
  return {
    path: anchor.path,
    from: { hunk: first.hunk, line: first.line },
    to: { hunk: last.hunk, line: last.line },
  };
}

export function linesInRange(hunks: Hunk[], from: LinePosition, to: LinePosition): DiffLine[] {
  return hunks.slice(from.hunk, to.hunk + 1).flatMap((hunk, offset) => {
    const hunkIndex = from.hunk + offset;
    const start = hunkIndex === from.hunk ? from.line : 0;
    const end = hunkIndex === to.hunk ? to.line + 1 : hunk.lines.length;
    return hunk.lines.slice(start, end);
  });
}

export function lineNumber(line: DiffLine | undefined): number | null {
  return line ? (line.newLine ?? line.oldLine) : null;
}

function commentLine(hunks: Hunk[], from: LinePosition, to: LinePosition): number | null {
  const newSide = linesInRange(hunks, from, to).filter((line) => line.newLine !== null);
  return newSide.at(-1)?.newLine ?? null;
}

export function targetPath(target: AssistTarget): string {
  return target.kind === "lines" ? target.range.path : target.path;
}

export function targetCommentLine(hunks: Hunk[], target: AssistTarget): number | null {
  return target.kind === "lines" ? commentLine(hunks, target.range.from, target.range.to) : null;
}
