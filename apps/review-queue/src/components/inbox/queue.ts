import type { ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import type { ProgressSummary } from "@/lib/session/store";

export type QueueEntry = {
  request: ReviewRequest;
  progress: ProgressSummary | null;
  movedSinceVisit: boolean;
};

export function initialsOf(login: string): string {
  const words = login.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] ?? "").slice(0, 2).toUpperCase();
}

export function movedSinceVisit(request: ReviewRequest, progress: ProgressSummary | null): boolean {
  return progress !== null && Date.parse(request.updatedAt) > Date.parse(progress.updatedAt);
}

function queueRank(progress: ProgressSummary | null): number {
  if (progress?.pause) return 0;
  if (progress) return 1;
  return 2;
}

export function orderQueue(
  requests: ReviewRequest[],
  progressByKey: Record<string, ProgressSummary>,
): QueueEntry[] {
  const entries = requests.map((request) => {
    const progress = progressByKey[prKey(request.ref)] ?? null;
    return { request, progress, movedSinceVisit: movedSinceVisit(request, progress) };
  });
  return entries.sort((a, b) => queueRank(a.progress) - queueRank(b.progress));
}
