import path from "node:path";
import { dataDirectory } from "@/lib/data-directory";
import {
  type Conversation,
  type ConversationView,
  loadConversation,
} from "@/lib/github/conversation";
import {
  getPullRequest,
  type LinkedIssue,
  listLinkedIssues,
  listPullRequestFacts,
  loadQueue,
  type PullRequestAuthorship,
  type PullRequestFacts,
  type QueueListName,
  type QueueLists,
  type ReviewRequest,
  viewerLogin,
} from "@/lib/github/gh";
import { TtlCache } from "@/lib/github/ttl-cache";
import type { LlmConfig } from "@/lib/llm/client";
import { llmConfig, resolveLlm } from "@/lib/llm/model-choice";
import { startModel, waitWhileStarting } from "@/lib/llm/model-start";
import { type ModelStatus, buildModelStatus } from "@/lib/llm/model-status";
import { prKey } from "@/lib/pr-ref";
import type { PullRequestRef } from "@/lib/types";
import { defaultDatabasePath, SessionStore } from "@/lib/session/store";
import { savedLlmSettings } from "@/lib/settings/llm-settings";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type { ReviewDeps } from "./prepare";

const REVIEW_REQUESTS_TTL_MS = 60_000;
const PULL_REQUEST_TTL_MS = 30_000;
const LINKED_ISSUES_TTL_MS = 5 * 60_000;

const globals = globalThis as {
  reviewQueueStore?: SessionStore;
  reviewQueueGitHubCache?: TtlCache;
  reviewQueueViewer?: Promise<string>;
};

export function sessionStore(): SessionStore {
  globals.reviewQueueStore ??= new SessionStore(
    process.env.REVIEW_QUEUE_DB ?? defaultDatabasePath(),
  );
  return globals.reviewQueueStore;
}

function githubCache(): TtlCache {
  globals.reviewQueueGitHubCache ??= new TtlCache();
  return globals.reviewQueueGitHubCache;
}

function queueLists(): Promise<QueueLists> {
  const repositories = savedRepositories(sessionStore());
  return githubCache().get(`queue:${repositories.join(",")}`, REVIEW_REQUESTS_TTL_MS, () =>
    loadQueue(repositories),
  );
}

async function queueList(name: QueueListName): Promise<ReviewRequest[]> {
  const list = (await queueLists())[name];
  if (list instanceof Error) throw list;
  return list;
}

export function reviewRequests(): Promise<ReviewRequest[]> {
  return queueList("waiting");
}

export function openPullRequests(authorship: PullRequestAuthorship): Promise<ReviewRequest[]> {
  return queueList(authorship);
}

export function pullRequestFacts(
  refs: PullRequestRef[],
): Promise<Record<string, PullRequestFacts>> {
  const keys = refs.map(prKey).sort();
  return githubCache().get(`facts:${keys.join(",")}`, REVIEW_REQUESTS_TTL_MS, () =>
    listPullRequestFacts(refs),
  );
}

export function refreshGitHubCache(): void {
  githubCache().clear();
}

function conversationKey(ref: PullRequestRef): string {
  return `conversation:${prKey(ref)}`;
}

export function conversation(ref: PullRequestRef): Promise<Conversation> {
  return githubCache().get(conversationKey(ref), PULL_REQUEST_TTL_MS, () =>
    loadConversation(ref, sessionStore()),
  );
}

export function linkedIssues(ref: PullRequestRef): Promise<LinkedIssue[]> {
  return githubCache().get(`linked-issues:${prKey(ref)}`, LINKED_ISSUES_TTL_MS, () =>
    listLinkedIssues(ref),
  );
}

function viewer(): Promise<string | null> {
  const lookup = (globals.reviewQueueViewer ??= viewerLogin());
  return lookup.catch(() => {
    if (globals.reviewQueueViewer === lookup) globals.reviewQueueViewer = undefined;
    return null;
  });
}

export async function conversationView(ref: PullRequestRef): Promise<ConversationView> {
  const [loaded, signedInAs] = await Promise.all([conversation(ref), viewer()]);
  return { ...loaded, viewer: signedInAs };
}

export function forgetConversation(ref: PullRequestRef): void {
  githubCache().forget(conversationKey(ref));
}

export function reviewDeps(): ReviewDeps {
  return {
    fetchPullRequest: (ref) =>
      githubCache().get(`pull-request:${prKey(ref)}`, PULL_REQUEST_TTL_MS, () =>
        getPullRequest(ref, sessionStore()),
      ),
    store: sessionStore(),
  };
}

export function currentLlmConfig(): Promise<LlmConfig> {
  return llmConfig(process.env, fetch, savedLlmSettings(sessionStore()));
}

export function currentModelStatus(): Promise<ModelStatus> {
  return buildModelStatus(process.env, fetch, savedLlmSettings(sessionStore()));
}

export async function startCurrentModel(): Promise<ModelStatus> {
  const { choice } = await resolveLlm(process.env, fetch, savedLlmSettings(sessionStore()));
  if (choice?.startCommand) {
    startModel(choice.startCommand, path.join(dataDirectory(), "model-server.log"));
  }
  return waitWhileStarting(currentModelStatus);
}
