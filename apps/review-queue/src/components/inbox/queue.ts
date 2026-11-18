import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { estimateMinutes } from "@/lib/plan/reading-path";
import { prKey } from "@/lib/pr-ref";
import { isSnoozed } from "@/lib/session/snooze";
import type { ProgressSummary, SnoozeUntil } from "@/lib/session/store";
import { formatDuration } from "./time";

export type QueueEntry = {
  request: ReviewRequest;
  facts: PullRequestFacts | null;
  progress: ProgressSummary | null;
  intent?: string | null;
};

type QueueKind = "paused" | "new-commits" | "started" | "not-started";

export type QueueSize = "S" | "M" | "L";

export const QUEUE_SORTS = ["recommended", "oldest", "newest", "smallest", "updated"] as const;

export type QueueSort = (typeof QUEUE_SORTS)[number];

type QueueComparator = (first: QueueEntry, second: QueueEntry) => number;

export type QueueLayout = {
  upNext: { entry: QueueEntry; reason: string } | null;
  continued: QueueEntry[];
  newCommits: QueueEntry[];
  waiting: QueueEntry[];
  later: QueueEntry[];
};

const SMALL_MAX_LINES = 300;
const MEDIUM_MAX_LINES = 800;

const MISSING = Number.MAX_SAFE_INTEGER;

const KIND_RANK: Record<QueueKind, number> = {
  paused: 0,
  "new-commits": 1,
  started: 2,
  "not-started": 3,
};

const SIZE_WORDS: Record<QueueSize, string> = { S: "small", M: "medium", L: "large" };

export function initialsOf(login: string): string {
  const words = login.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? "").slice(0, 2).toUpperCase();
}

function changedLineCount(facts: PullRequestFacts): number {
  return facts.additions + facts.deletions;
}

export function sizeOf(facts: PullRequestFacts): QueueSize {
  const lines = changedLineCount(facts);
  if (lines <= SMALL_MAX_LINES) return "S";
  if (lines <= MEDIUM_MAX_LINES) return "M";
  return "L";
}

export function estimateReadingMinutes(facts: PullRequestFacts): number {
  return estimateMinutes(changedLineCount(facts));
}

function classifyEntry(entry: QueueEntry): QueueKind {
  if (entry.progress?.pause) return "paused";
  const { progress, facts } = entry;
  if (
    progress &&
    facts &&
    progress.lastHeadSha !== null &&
    progress.lastHeadSha !== facts.headSha
  ) {
    return "new-commits";
  }
  return progress ? "started" : "not-started";
}

function checksRank(entry: QueueEntry): number {
  return entry.facts?.checks === "passing" ? 0 : 1;
}

function changedLinesOf(entry: QueueEntry): number {
  return entry.facts ? changedLineCount(entry.facts) : MISSING;
}

function createdAtOf(entry: QueueEntry): number {
  return entry.facts ? Date.parse(entry.facts.createdAt) : MISSING;
}

function updatedAtOf(entry: QueueEntry): number {
  return Date.parse(entry.request.updatedAt);
}

function compareNewestFirst(first: number, second: number): number {
  if (first === MISSING || second === MISSING) {
    return Number(first === MISSING) - Number(second === MISSING);
  }
  return second - first;
}

const SORT_COMPARATORS: Record<QueueSort, QueueComparator> = {
  recommended: (first, second) =>
    checksRank(first) - checksRank(second) ||
    changedLinesOf(first) - changedLinesOf(second) ||
    createdAtOf(first) - createdAtOf(second),
  oldest: (first, second) => createdAtOf(first) - createdAtOf(second),
  newest: (first, second) => compareNewestFirst(createdAtOf(first), createdAtOf(second)),
  smallest: (first, second) => changedLinesOf(first) - changedLinesOf(second),
  updated: (first, second) => updatedAtOf(second) - updatedAtOf(first),
};

export function parseQueueSort(value: unknown): QueueSort {
  return QUEUE_SORTS.find((sort) => sort === value) ?? "recommended";
}

export function rankQueue(entries: QueueEntry[], sort: QueueSort = "recommended"): QueueEntry[] {
  const compareWithinKind = SORT_COMPARATORS[sort];
  return [...entries].sort(
    (first, second) =>
      KIND_RANK[classifyEntry(first)] - KIND_RANK[classifyEntry(second)] ||
      compareWithinKind(first, second),
  );
}

export function isEntrySnoozed(
  entry: QueueEntry,
  snoozes: Record<string, SnoozeUntil>,
  now: number,
): boolean {
  const until = snoozes[prKey(entry.request.ref)];
  return until !== undefined && isSnoozed(until, entry.facts?.headSha ?? "", now);
}

export function describeSnooze(until: SnoozeUntil): string {
  return "at" in until ? "Snoozed until tomorrow" : "Snoozed until new commits";
}

function pickReason(entry: QueueEntry, now: number): string {
  const kind = classifyEntry(entry);
  if (kind === "paused") return "Picked because you paused it.";
  if (kind === "new-commits") return "Picked because it has new commits since your review.";
  if (kind === "started") return "Picked because you already started it.";
  if (!entry.facts) return "Picked because it is next in line.";
  const checks = entry.facts.checks === "passing" ? ", checks pass" : "";
  const waited = formatDuration(now - createdAtOf(entry));
  return `Picked because it is ${SIZE_WORDS[sizeOf(entry.facts)]}${checks}, and it has waited ${waited}.`;
}

export function layoutQueue(
  entries: QueueEntry[],
  snoozes: Record<string, SnoozeUntil>,
  now: number,
  sort: QueueSort = "recommended",
): QueueLayout {
  const active = rankQueue(
    entries.filter((entry) => !isEntrySnoozed(entry, snoozes, now)),
    sort,
  );
  const later = rankQueue(
    entries.filter((entry) => isEntrySnoozed(entry, snoozes, now)),
    sort,
  );
  const [first, ...rest] = active;
  const bumpKindOf = (entry: QueueEntry) => classifyEntry(entry);
  return {
    upNext: first ? { entry: first, reason: pickReason(first, now) } : null,
    continued: rest.filter((entry) => ["paused", "started"].includes(bumpKindOf(entry))),
    newCommits: rest.filter((entry) => bumpKindOf(entry) === "new-commits"),
    waiting: rest.filter((entry) => bumpKindOf(entry) === "not-started"),
    later,
  };
}
