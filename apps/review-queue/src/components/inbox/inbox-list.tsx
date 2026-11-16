import { ArrowRight, Bot, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { REVIEW_REQUEST_LIMIT, type ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import type { PauseState, ProgressSummary } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";
import { isPondClear, loadInbox } from "./inbox-data";
import { PostedList } from "./posted-list";
import { initialsOf, orderQueue, type QueueEntry } from "./queue";

export { failureMessage } from "./inbox-data";

function ProgressBadges({ entry }: { entry: QueueEntry }) {
  if (!entry.progress) return <Badge variant="outline">Not started</Badge>;
  return (
    <>
      <Badge variant="blue">Resume, {entry.progress.doneCount} steps done</Badge>
      {entry.movedSinceVisit && <Badge variant="amber">Activity since your visit</Badge>}
    </>
  );
}

function PausedNote({ pause }: { pause: PauseState }) {
  const note = pause.note.trim();
  return (
    <span className="flex flex-wrap items-center gap-s-2 text-sm">
      <span className="rounded-pill bg-callout px-s-3 py-0.5 text-callout-foreground">
        {note ? `You were about to: ${note}` : "Paused"}
      </span>
      <span className="text-fg-muted">{relativeTime(pause.at)}</span>
    </span>
  );
}

function InboxRow({ entry }: { entry: QueueEntry }) {
  const { request, progress } = entry;
  return (
    <li className="flex items-center gap-s-2">
      <Link
        href={prPath(request.ref)}
        className="flex min-w-0 flex-1 items-center gap-s-4 rounded-md border border-line-soft bg-surface-2 px-s-4 py-s-3 transition-colors duration-calm hover:border-line hover:bg-surface-3 focus-visible:bg-surface-3"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-violet font-display text-sm font-semibold text-ink-violet"
        >
          {initialsOf(request.author)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-s-1">
          <span className="font-display text-lg leading-snug font-semibold">
            <InlineMarkdown text={request.title} />
          </span>
          <span className="flex flex-wrap gap-x-s-3 text-sm text-fg-muted">
            <span className="font-mono text-fg">{prKey(request.ref)}</span>
            <span>by {request.author}</span>
            <span>updated {relativeTime(request.updatedAt)}</span>
            {request.isDraft && <span>draft</span>}
          </span>
          {progress?.pause && <PausedNote pause={progress.pause} />}
          <span className="flex flex-wrap gap-s-2">
            <ProgressBadges entry={entry} />
          </span>
        </span>
        <Button variant="soft" asChild className="shrink-0">
          <span>
            Start <ArrowRight />
          </span>
        </Button>
      </Link>
      <div className="pr-s-1">
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Open on GitHub"
          aria-label={`Open ${prKey(request.ref)} on GitHub`}
          asChild
        >
          <a href={request.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </HintButton>
      </div>
    </li>
  );
}

function QueueRows({ entries }: { entries: QueueEntry[] }) {
  const started = entries.filter((entry) => entry.progress);
  const notStarted = entries.filter((entry) => !entry.progress);
  return (
    <>
      {started.map((entry) => (
        <InboxRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
      {started.length > 0 && notStarted.length > 0 && (
        <li className="px-s-1 text-sm font-medium text-fg-muted">Not started</li>
      )}
      {notStarted.map((entry) => (
        <InboxRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
    </>
  );
}

function QueueSection({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col gap-s-4">
      <div className="flex flex-wrap items-center justify-between gap-s-3">
        <h2 className="font-display text-2xl font-semibold">
          {title} <span className="tabular-nums text-fg-muted">({count})</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RequestQueue({
  title,
  action,
  requests,
  progress,
  error,
  emptyMessage,
}: {
  title: string;
  action?: ReactNode;
  requests: ReviewRequest[];
  progress: Record<string, ProgressSummary>;
  error: string | null;
  emptyMessage: ReactNode;
}) {
  if (error) {
    return (
      <QueueSection title={title} count={0} action={action}>
        <Card className="gap-2 px-5 text-sm border-destructive/40">
          <p>
            🔌 Couldn&apos;t reach GitHub through <code className="font-mono">gh</code>. Is it
            installed and logged in?
          </p>
          <p className="font-mono text-sm text-fg-muted">{error}</p>
        </Card>
      </QueueSection>
    );
  }
  if (requests.length === 0) {
    return (
      <QueueSection title={title} count={0} action={action}>
        <div className="rounded-md border border-line-soft bg-surface-2">
          <EmptyState emoji="🌴">{emptyMessage}</EmptyState>
        </div>
      </QueueSection>
    );
  }
  return (
    <QueueSection title={title} count={requests.length} action={action}>
      {requests.length === REVIEW_REQUEST_LIMIT && (
        <p className="text-sm text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
      )}
      <ul className="grid min-h-0 gap-s-2 overflow-y-auto">
        <QueueRows entries={orderQueue(requests, progress)} />
      </ul>
    </QueueSection>
  );
}

function batchedBumpsMessage(count: number): string {
  if (count === 0) return "No dependency bumps waiting.";
  if (count === 1) return "1 dependency bump, batched for later.";
  return `${count} dependency bumps, batched for later.`;
}

function DependabotSummary({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-s-2 rounded-md border border-dashed border-line px-s-4 text-sm text-fg-muted">
      <Bot aria-hidden="true" className="text-ink-violet" />
      <span>{batchedBumpsMessage(count)}</span>
      <Link
        href="/dependabot"
        className="inline-flex min-h-11 items-center font-bold text-ink-violet"
      >
        See Dependabot
      </Link>
    </p>
  );
}

export async function InboxList() {
  const inbox = await loadInbox();
  return (
    <div className="flex min-h-0 flex-col gap-s-7">
      {!isPondClear(inbox) && (
        <RequestQueue
          title="Waiting for You"
          requests={inbox.requests}
          progress={inbox.progress}
          error={inbox.requestsError}
          emptyMessage="Nothing is waiting for your review. Enjoy it."
        />
      )}
      {inbox.hasRepositories ? (
        <RequestQueue
          title="Open in Your Repositories"
          action={
            <Button variant="ghost" asChild className="text-fg-muted">
              <Link href="/dependabot">Dependabot PRs</Link>
            </Button>
          }
          requests={inbox.repositoryRequests}
          progress={inbox.progress}
          error={inbox.repositoryError}
          emptyMessage="No open pull requests in your repositories."
        />
      ) : (
        <p className="text-sm text-fg-muted">
          Pick repositories in{" "}
          <Link href="/settings" className="text-fg underline underline-offset-4">
            Settings
          </Link>{" "}
          to see their open PRs here
        </p>
      )}
      <PostedList reviews={inbox.posted} />
      <DependabotSummary count={inbox.dependabotCount} />
    </div>
  );
}
