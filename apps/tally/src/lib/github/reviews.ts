import type { Runner } from "@/lib/exec";
import type { TallyEvent } from "@/lib/store/events";
import { fetchLogin, searchAll } from "./search";

type ReviewNode = { url: string; submittedAt: string | null };

type PullRequestNode = {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  reviews: { nodes: ReviewNode[] };
};

function reviewedFields(login: string): string {
  return `title
        url
        repository { nameWithOwner }
        reviews(author: ${JSON.stringify(login)}, last: 50) { nodes { url submittedAt } }`;
}

function toEvents(pullRequest: PullRequestNode, sinceTimestamp: string): TallyEvent[] {
  return pullRequest.reviews.nodes.flatMap((review) =>
    review.submittedAt !== null && review.submittedAt >= sinceTimestamp
      ? [
          {
            source: "github",
            kind: "pr_reviewed",
            externalId: review.url,
            occurredAt: review.submittedAt,
            repo: pullRequest.repository.nameWithOwner,
            title: pullRequest.title,
            url: pullRequest.url,
          } satisfies TallyEvent,
        ]
      : [],
  );
}

export async function fetchReviewedPrs(run: Runner, sinceDate: string): Promise<TallyEvent[]> {
  const login = await fetchLogin(run);
  const pullRequests = await searchAll<PullRequestNode>(run, {
    label: "pull requests I reviewed",
    search: `is:pr reviewed-by:${login} -author:${login} updated:>=${sinceDate}`,
    fields: reviewedFields(login),
  });
  return pullRequests.flatMap((pullRequest) => toEvents(pullRequest, `${sinceDate}T00:00:00Z`));
}
