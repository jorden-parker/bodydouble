import { connection } from "next/server";
import { cache } from "react";
import type { ReviewRequest } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, reviewRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type { InProgressSession, ProgressSummary, RecentSubmission } from "@/lib/session/store";
import { POSTED_REVIEW_LIMIT } from "./posted-list";

export type Inbox = {
  requests: ReviewRequest[];
  requestsError: string | null;
  repositoryRequests: ReviewRequest[];
  repositoryError: string | null;
  dependabotCount: number | null;
  hasRepositories: boolean;
  progress: Record<string, ProgressSummary>;
  inProgress: InProgressSession[];
  archived: InProgressSession[];
  posted: RecentSubmission[];
};

export function failureMessage(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

export function isPondClear(inbox: Pick<Inbox, "requests" | "requestsError">): boolean {
  return inbox.requests.length === 0 && inbox.requestsError === null;
}

export const loadInbox = cache(async (): Promise<Inbox> => {
  await connection();
  const store = sessionStore();
  const [waiting, repositories, dependabot] = await Promise.allSettled([
    reviewRequests(),
    openPullRequests("others"),
    openPullRequests("dependabot"),
  ]);
  const requests = waiting.status === "fulfilled" ? waiting.value : [];
  const waitingKeys = new Set(requests.map((request) => prKey(request.ref)));
  const repositoryRequests =
    repositories.status === "fulfilled"
      ? repositories.value.filter((request) => !waitingKeys.has(prKey(request.ref)))
      : [];
  const listedKeys = new Set([
    ...waitingKeys,
    ...repositoryRequests.map((request) => prKey(request.ref)),
  ]);
  return {
    requests,
    requestsError: waiting.status === "rejected" ? failureMessage(waiting.reason) : null,
    repositoryRequests,
    repositoryError:
      repositories.status === "rejected" ? failureMessage(repositories.reason) : null,
    dependabotCount: dependabot.status === "fulfilled" ? dependabot.value.length : null,
    hasRepositories: savedRepositories(store).length > 0,
    progress: store.progressSummaries([...listedKeys]),
    inProgress: store.inProgress().filter((session) => !listedKeys.has(session.key)),
    archived: store.archived().filter((session) => !listedKeys.has(session.key)),
    posted: store.recentSubmissions(POSTED_REVIEW_LIMIT),
  };
});
