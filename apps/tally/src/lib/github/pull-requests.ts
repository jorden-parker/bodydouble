import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";
import type { OpenItem } from "@/lib/store/open-items";
import type { ReviewStatus } from "@/lib/store/pull-request-reviews";
import type { WorkItem } from "@/lib/store/work";
import { fetchLogin, searchAll } from "./search";

type SearchedPullRequest = {
  title: string;
  url: string;
  createdAt: string;
  repository: { nameWithOwner: string };
};

type AuthoredPullRequest = SearchedPullRequest & {
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
};

type MergedPullRequest = AuthoredPullRequest & { mergedAt: string };

export type AuthoredPullRequests = { created: TallyEvent[]; merged: WorkItem[] };

type OpenPullRequest = SearchedPullRequest & {
  isDraft: boolean;
  headRefName: string;
  author: { login: string } | null;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  reviews: { totalCount: number };
  myReviews: { nodes: { state: string }[] };
};

export type ReviewablePullRequest = OpenItem & { headRefName: string; author: string };

const AUTHORED_QUERY = `query($search: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        title
        url
        createdAt
        mergedAt
        additions
        deletions
        changedFiles
        repository { nameWithOwner }
      }
    }
  }
}`;

const OPEN_QUERY = `query($search: String!, $login: String!, $after: String) {
  search(query: $search, type: ISSUE, first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        title
        url
        createdAt
        isDraft
        headRefName
        author { login }
        repository { nameWithOwner }
        reviewDecision
        reviews { totalCount }
        myReviews: reviews(author: $login, last: 1) { nodes { state } }
      }
    }
  }
}`;

function toEvent(
  kind: TallyEvent["kind"],
  pullRequest: Pick<SearchedPullRequest, "title" | "url" | "repository">,
  occurredAt: string,
): TallyEvent {
  return {
    source: "github",
    kind,
    externalId: pullRequest.url,
    occurredAt,
    repo: pullRequest.repository.nameWithOwner,
    title: pullRequest.title,
    url: pullRequest.url,
  };
}

function toWorkItem(pullRequest: MergedPullRequest): WorkItem {
  return {
    ...toEvent("pr_merged", pullRequest, pullRequest.mergedAt),
    startedAt: pullRequest.createdAt,
    points: null,
    storyType: null,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changedFiles: pullRequest.changedFiles,
  };
}

function authorStatus(pullRequest: OpenPullRequest): ReviewStatus {
  if (pullRequest.reviewDecision === "APPROVED") return "approved";
  if (pullRequest.reviewDecision === "CHANGES_REQUESTED") return "changes_requested";
  return pullRequest.reviews.totalCount > 0 ? "in_review" : "awaiting_review";
}

function myLastReviewState(pullRequest: OpenPullRequest): string | null {
  return pullRequest.myReviews.nodes[0]?.state ?? null;
}

function reviewerStatus(pullRequest: OpenPullRequest): ReviewStatus {
  const state = myLastReviewState(pullRequest);
  if (state === null) return "awaiting_review";
  return state === "CHANGES_REQUESTED" ? "changes_requested" : "in_review";
}

function toReviewablePullRequest(
  pullRequest: OpenPullRequest,
  reviewStatus: ReviewStatus,
): ReviewablePullRequest {
  return {
    source: "github",
    externalId: pullRequest.url,
    openedAt: pullRequest.createdAt,
    isDraft: pullRequest.isDraft,
    repo: pullRequest.repository.nameWithOwner,
    title: pullRequest.title,
    url: pullRequest.url,
    reviewStatus,
    headRefName: pullRequest.headRefName,
    author: pullRequest.author?.login ?? "",
  };
}

async function searchOpenPullRequests(
  run: Runner,
  login: string,
  filters: string,
): Promise<OpenPullRequest[]> {
  return searchAll<OpenPullRequest>(run, OPEN_QUERY, { search: `is:pr is:open ${filters}`, login });
}

function distinctByUrl(pullRequests: OpenPullRequest[]): OpenPullRequest[] {
  const seen = new Set<string>();
  return pullRequests.filter((pullRequest) => {
    if (seen.has(pullRequest.url)) return false;
    seen.add(pullRequest.url);
    return true;
  });
}

function isMerged(pullRequest: AuthoredPullRequest): pullRequest is MergedPullRequest {
  return pullRequest.mergedAt !== null;
}

export async function fetchAuthoredPrs(
  run: Runner,
  sinceDate: string,
): Promise<AuthoredPullRequests> {
  const login = await fetchLogin(run);
  const search = `is:pr author:${login} updated:>=${sinceDate} sort:updated-desc`;
  const authored = await searchAll<AuthoredPullRequest>(run, AUTHORED_QUERY, { search });
  const sinceTimestamp = `${sinceDate}T00:00:00Z`;
  return {
    created: authored
      .filter((pullRequest) => pullRequest.createdAt >= sinceTimestamp)
      .map((pullRequest) => toEvent("pr_created", pullRequest, pullRequest.createdAt)),
    merged: authored
      .filter(isMerged)
      .filter((pullRequest) => pullRequest.mergedAt >= sinceTimestamp)
      .map(toWorkItem),
  };
}

export async function fetchOpenAuthoredPrs(run: Runner): Promise<ReviewablePullRequest[]> {
  const login = await fetchLogin(run);
  const open = await searchOpenPullRequests(run, login, `author:${login}`);
  return open.map((pullRequest) => toReviewablePullRequest(pullRequest, authorStatus(pullRequest)));
}

export async function fetchPullRequestsToReview(run: Runner): Promise<ReviewablePullRequest[]> {
  const login = await fetchLogin(run);
  const requested = await searchOpenPullRequests(run, login, `review-requested:${login}`);
  const reviewed = await searchOpenPullRequests(
    run,
    login,
    `reviewed-by:${login} -author:${login}`,
  );
  return distinctByUrl([...requested, ...reviewed])
    .filter((pullRequest) => myLastReviewState(pullRequest) !== "APPROVED")
    .map((pullRequest) => toReviewablePullRequest(pullRequest, reviewerStatus(pullRequest)));
}
