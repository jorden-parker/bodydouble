import { type AssistTarget, lineNumber, linesInRange } from "@/lib/assist-protocol";
import type { Hunk } from "@/lib/types";

export type TargetChip = { path: string | null; text: string };

const NBSP = " ";

function spanOf(hunks: Hunk[], target: Extract<AssistTarget, { kind: "lines" }>): string {
  const lines = linesInRange(hunks, target.range.from, target.range.to);
  const first = lineNumber(lines[0]);
  const last = lineNumber(lines.at(-1));
  return first === last ? `L${first}` : `L${first}–${last}`;
}

export function targetChipOf(
  target: AssistTarget,
  hunks: Hunk[],
  stepNumber: number | null,
): TargetChip {
  if (target.kind === "file") return { path: target.path, text: "whole file" };
  if (target.kind === "check")
    return {
      path: null,
      text: `Step${NBSP}${stepNumber ?? "?"}${NBSP}· check${NBSP}${target.check + 1}`,
    };
  return { path: target.range.path, text: spanOf(hunks, target) };
}
