import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parsePullRequestRef, prPath } from "@/lib/pr-ref";
import { VERDICT_LABELS } from "@/lib/review/verdict-labels";
import type { RecentSubmission } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";

export const POSTED_REVIEW_LIMIT = 10;

function PostedRow({ review }: { review: RecentSubmission }) {
  const ref = parsePullRequestRef(review.key);
  return (
    <li className="flex flex-wrap items-center gap-x-s-4 gap-y-s-2 rounded-md border border-line-soft bg-surface-2 px-s-4 py-s-3">
      <span className="flex min-w-0 flex-1 flex-col gap-s-1">
        <span className="font-display font-semibold">
          <InlineMarkdown text={review.title ?? review.key} />
        </span>
        <span className="flex flex-wrap gap-x-s-3 text-sm text-fg-muted">
          <span>{review.key}</span>
          <span>posted {relativeTime(review.postedAt)}</span>
        </span>
      </span>
      <Badge variant="outline">{VERDICT_LABELS[review.event]}</Badge>
      <span className="flex items-center gap-s-1">
        {ref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={prPath(ref)}>Open</Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild>
          <a href={review.url} target="_blank" rel="noreferrer">
            On GitHub
          </a>
        </Button>
      </span>
    </li>
  );
}

export function PostedList({ reviews }: { reviews: RecentSubmission[] }) {
  return (
    <section className="flex min-h-0 flex-col gap-s-4">
      <h2 className="font-display text-2xl font-semibold">Posted</h2>
      {reviews.length === 0 ? (
        <div className="rounded-md border border-line-soft bg-surface-2">
          <EmptyState emoji="📭">Nothing posted yet</EmptyState>
        </div>
      ) : (
        <>
          <ul className="grid min-h-0 gap-s-2 overflow-y-auto">
            {reviews.map((review) => (
              <PostedRow key={review.reviewId} review={review} />
            ))}
          </ul>
          {reviews.length === POSTED_REVIEW_LIMIT && (
            <p className="text-sm text-fg-muted">Showing the latest {POSTED_REVIEW_LIMIT}</p>
          )}
        </>
      )}
    </section>
  );
}
