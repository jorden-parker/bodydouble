import {
  type AssistAction,
  type AssistLookup,
  type AssistTarget,
  type AssistThread,
  type AssistTurn,
  MAX_HISTORY_TURNS,
} from "@/lib/assist-protocol";
import type { AssistRequest } from "@/lib/review/assist-request";

type HistoryMessage = AssistRequest["history"][number];

export type RunOptions = Pick<AssistRequest, "hasMoreDetail" | "lookupBudget" | "shouldEscalate">;

type TurnDetails = {
  lookups?: AssistLookup[];
  hasBudgetEnded?: boolean;
  isFromClaude?: boolean;
};

const SUBJECTS: Record<AssistTarget["kind"], string> = {
  lines: "these lines",
  file: "this file",
  check: "this check",
};

function subject(target: AssistTarget): string {
  return SUBJECTS[target.kind];
}

function actionLabel(action: AssistAction, target: AssistTarget): string {
  const labels: Record<AssistAction, string> = {
    explain: `Explain ${subject(target)}`,
    simplify: `Simplify ${subject(target)}`,
    comment: "Draft a review comment",
    ask: `Ask about ${subject(target)}`,
    check: `Check the flag on ${subject(target)}`,
    review: `Review ${subject(target)}`,
  };
  return labels[action];
}

export function openThread(
  target: AssistTarget,
  action: AssistAction,
  headSha: string,
  question: string | null = null,
): AssistThread {
  const text = question ?? actionLabel(action, target);
  return {
    id: crypto.randomUUID(),
    headSha,
    target,
    action,
    question,
    turns: [{ role: "reviewer", text }],
  };
}

function targetKey(target: AssistTarget): string {
  return JSON.stringify(target);
}

export function exchangeToContinue(
  exchanges: AssistThread[],
  target: AssistTarget,
  headSha: string,
): AssistThread | null {
  const latest = exchanges.at(-1);
  if (!latest || latest.headSha !== headSha || targetKey(latest.target) !== targetKey(target))
    return null;
  return canFollowUp(latest) ? latest : null;
}

export function withFollowUp(thread: AssistThread, question: string): AssistThread {
  return { ...thread, turns: [...thread.turns, { role: "reviewer", text: question }] };
}

function detailFields(details: TurnDetails): Partial<AssistTurn> {
  return {
    ...(details.lookups?.length ? { lookups: details.lookups } : {}),
    ...(details.hasBudgetEnded ? { hasBudgetEnded: true } : {}),
    ...(details.isFromClaude ? { isFromClaude: true } : {}),
  };
}

export function withModelText(
  thread: AssistThread,
  text: string,
  details: TurnDetails = {},
): AssistThread {
  const last = thread.turns.at(-1);
  const earlier = last?.role === "model" ? thread.turns.slice(0, -1) : thread.turns;
  const turn: AssistTurn = { role: "model", text, ...detailFields(details) };
  return { ...thread, turns: [...earlier, turn] };
}

export function withoutLastModelTurn(thread: AssistThread): AssistThread {
  if (thread.turns.at(-1)?.role !== "model") return thread;
  return { ...thread, turns: thread.turns.slice(0, -1) };
}

export function withEnding(thread: AssistThread, ended: "stopped" | "failed" | null): AssistThread {
  const last = thread.turns.at(-1);
  if (last?.role !== "model") return thread;
  if (last.text.trim() === "") return withoutLastModelTurn(thread);
  if (ended === null) return thread;
  return { ...thread, turns: [...thread.turns.slice(0, -1), { ...last, ended }] };
}

export function canFollowUp(thread: AssistThread): boolean {
  return thread.turns.at(-1)?.role === "model" && thread.turns.length <= MAX_HISTORY_TURNS;
}

function asMessage(turn: AssistTurn): HistoryMessage {
  return { role: turn.role === "model" ? "assistant" : "user", content: turn.text };
}

export function threadRequest(thread: AssistThread, options: RunOptions = {}): AssistRequest {
  return {
    action: thread.action,
    target: thread.target,
    question: thread.question,
    history: thread.turns.slice(1).map(asMessage),
    ...options,
  };
}
