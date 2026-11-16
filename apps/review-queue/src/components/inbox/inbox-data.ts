import { connection } from "next/server";
import { cache } from "react";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import type { LlmConfig } from "@/lib/llm/client";
import { gitHubPullRequestUrl, parsePullRequestRef, prKey } from "@/lib/pr-ref";
import { storedOrientationFor } from "@/lib/review/orientation-service";
import {
  currentLlmConfig,
  openPullRequests,
  pullRequestFacts,
  reviewRequests,
  sessionStore,
} from "@/lib/review/services";
import { savedPreparationSetting } from "@/lib/settings/preparation-settings";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type {
  InProgressSession,
  ProgressSummary,
  RecentSubmission,
  SessionStore,
  SnoozeUntil,
} from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { type BumpCounts, bumpCounts } from "./bump";
import type { QueueEntry } from "./queue";

const POSTED_REVIEW_LIMIT = 10;

export type Inbox = {
  loadedAt: string;
  waitingCount: number;
  requestsError: string | null;
  entries: QueueEntry[];
  repositoryError: string | null;
  dependabot: BumpCounts | null;
  smartlingCount: number | null;
  hasRepositories: boolean;
  snoozes: Record<string, SnoozeUntil>;
  archived: QueueEntry[];
  posted: RecentSubmission[];
  isPrepareNextOn: boolean;
};

export function failureMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

export function isPondClear(inbox: Pick<Inbox, "waitingCount" | "requestsError">): boolean {
  return inbox.waitingCount === 0 && inbox.requestsError === null;
}

function dedupeRefs(refs: PullRequestRef[]): PullRequestRef[] {
  return [...new Map(refs.map((ref) => [prKey(ref), ref])).values()];
}

async function loadFacts(refs: PullRequestRef[]): Promise<Record<string, PullRequestFacts>> {
  try {
    return await pullRequestFacts(refs);
  } catch {
    return {};
  }
}

function buildEntry(
  request: ReviewRequest,
  facts: Record<string, PullRequestFacts>,
  progress: Record<string, ProgressSummary>,
): QueueEntry {
  const key = prKey(request.ref);
  return { request, facts: facts[key] ?? null, progress: progress[key] ?? null };
}

function buildSessionEntries(
  sessions: InProgressSession[],
  facts: Record<string, PullRequestFacts>,
  progress: Record<string, ProgressSummary>,
): QueueEntry[] {
  return sessions.flatMap((session) => {
    const ref = parsePullRequestRef(session.key);
    if (!ref || facts[session.key]?.isMerged === true) return [];
    const request: ReviewRequest = {
      ref,
      title: session.title ?? session.key,
      url: gitHubPullRequestUrl(ref),
      author: "",
      updatedAt: session.updatedAt,
    };
    return [buildEntry(request, facts, progress)];
  });
}

export function attachIntents(
  entries: QueueEntry[],
  store: SessionStore,
  config: LlmConfig,
): QueueEntry[] {
  return entries.map((entry) => {
    const headSha = entry.facts?.headSha;
    const orientation =
      config.enabled && headSha
        ? storedOrientationFor(entry.request.ref, headSha, store, config)
        : null;
    return { ...entry, intent: orientation?.intent ?? null };
  });
}

export function readSnoozes(store: SessionStore): Record<string, SnoozeUntil> {
  return Object.fromEntries(store.snoozes().map((snooze) => [snooze.key, snooze.until]));
}

export async function buildQueueEntries(requests: ReviewRequest[]): Promise<QueueEntry[]> {
  const store = sessionStore();
  const refs = requests.map((request) => request.ref);
  const facts = await loadFacts(refs);
  const progress = store.progressSummaries(refs.map(prKey));
  return requests.map((request) => buildEntry(request, facts, progress));
}

export const loadInbox = cache(async (): Promise<Inbox> => {
  await connection();
  const store = sessionStore();
  const [waiting, repositories, dependabot, smartling] = await Promise.allSettled([
    reviewRequests(),
    openPullRequests("others"),
    openPullRequests("dependabot"),
    openPullRequests("smartling"),
  ]);
  const requests = waiting.status === "fulfilled" ? waiting.value : [];
  const waitingKeys = new Set(requests.map((request) => prKey(request.ref)));
  const repositoryRequests =
    repositories.status === "fulfilled"
      ? repositories.value.filter((request) => !waitingKeys.has(prKey(request.ref)))
      : [];
  const listed = [...requests, ...repositoryRequests];
  const listedKeys = new Set(listed.map((request) => prKey(request.ref)));
  const unlisted = (session: InProgressSession) => !listedKeys.has(session.key);
  const inProgress = store.inProgress().filter(unlisted);
  const archived = store.archived().filter(unlisted);
  const posted = store.recentSubmissions(POSTED_REVIEW_LIMIT);
  const sessionRefs = [...inProgress, ...archived, ...posted].flatMap(
    (session) => parsePullRequestRef(session.key) ?? [],
  );
  const refs = dedupeRefs([...listed.map((request) => request.ref), ...sessionRefs]);
  const facts = await loadFacts(refs);
  const progress = store.progressSummaries(refs.map(prKey));
  const config = await currentLlmConfig();
  return {
    loadedAt: new Date().toISOString(),
    waitingCount: requests.length,
    requestsError: waiting.status === "rejected" ? failureMessage(waiting.reason) : null,
    entries: attachIntents(
      [
        ...listed.map((request) => buildEntry(request, facts, progress)),
        ...buildSessionEntries(inProgress, facts, progress),
      ],
      store,
      config,
    ),
    repositoryError:
      repositories.status === "rejected" ? failureMessage(repositories.reason) : null,
    dependabot:
      dependabot.status === "fulfilled"
        ? bumpCounts(dependabot.value.map((request) => request.title))
        : null,
    smartlingCount: smartling.status === "fulfilled" ? smartling.value.length : null,
    hasRepositories: savedRepositories(store).length > 0,
    snoozes: readSnoozes(store),
    archived: attachIntents(buildSessionEntries(archived, facts, progress), store, config),
    posted: posted.filter((review) => facts[review.key]?.isMerged !== true),
    isPrepareNextOn: savedPreparationSetting(store),
  };
});
