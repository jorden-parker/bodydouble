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
import {
  chosenRepository,
  filterByRepository,
  RepositoryFilter,
  type RepositorySearchParams,
} from "./repository-filter";

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
    <span className="flex flex-wrap items-center gap-2 text-label">
      <span className="rounded-sm bg-callout px-2 py-0.5 wrap-anywhere text-callout-foreground">
        {note ? `You were about to: ${note}` : "Paused"}
      </span>
      <span className="text-fg-muted">{relativeTime(pause.at)}</span>
    </span>
  );
}

function InboxRow({ entry }: { entry: QueueEntry }) {
  const { request, progress } = entry;
  return (
    <li className="group flex min-w-0 items-center transition-colors duration-calm hover:bg-surface-2 has-[a:focus-visible]:bg-surface-2">
      <Link href={prPath(request.ref)} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-line-soft bg-surface text-label font-medium text-fg-muted"
        >
          {initialsOf(request.author)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium wrap-anywhere">
            <InlineMarkdown text={request.title} />
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-label text-fg-muted">
            <span className="font-mono text-fg wrap-anywhere">{prKey(request.ref)}</span>
            <span>by {request.author}</span>
            <span>updated {relativeTime(request.updatedAt)}</span>
          </span>
          {progress?.pause && <PausedNote pause={progress.pause} />}
          <span className="flex flex-wrap gap-2">
            <ProgressBadges entry={entry} />
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 self-center text-label font-medium text-fg-muted transition-colors duration-calm group-hover:text-fg sm:inline-flex">
          Start
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform duration-calm ease-calm motion-safe:group-hover:translate-x-0.5"
          />
        </span>
      </Link>
      <div className="shrink-0 pr-2">
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Open on GitHub"
          aria-label={`Open ${prKey(request.ref)} on GitHub`}
          className="hover:bg-surface-3"
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
        <li className="bg-surface-2 px-4 py-2 text-label font-medium text-fg-muted">Not started</li>
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
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading">
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
        <Card className="gap-2 border-destructive/40">
          <p>
            <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
            <code className="font-mono">gh</code>. Is it installed and logged in?
          </p>
          <p className="font-mono text-label text-fg-muted wrap-anywhere">{error}</p>
        </Card>
      </QueueSection>
    );
  }
  if (requests.length === 0) {
    return (
      <QueueSection title={title} count={0} action={action}>
        <EmptyState emoji="🌴">{emptyMessage}</EmptyState>
      </QueueSection>
    );
  }
  return (
    <QueueSection title={title} count={requests.length} action={action}>
      {requests.length === REVIEW_REQUEST_LIMIT && (
        <p className="text-label text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
      )}
      <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
        <QueueRows entries={orderQueue(requests, progress)} />
      </ul>
    </QueueSection>
  );
}

function batchedMessage(count: number, change: string): string {
  if (count === 0) return `No ${change}s waiting.`;
  if (count === 1) return `1 ${change}, batched for later.`;
  return `${count} ${change}s, batched for later.`;
}

function BatchedSummary({
  count,
  change,
  botName,
  href,
}: {
  count: number | null;
  change: string;
  botName: string;
  href: string;
}) {
  if (count === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-card px-4 py-3 text-sm text-fg-muted">
      <Bot aria-hidden="true" className="size-4 shrink-0" />
      <span>{batchedMessage(count, change)}</span>
      <Link
        href={href}
        className="inline-flex min-h-8 items-center font-medium text-fg underline underline-offset-4"
      >
        See {botName}
      </Link>
    </p>
  );
}

export async function InboxList({ searchParams }: { searchParams?: RepositorySearchParams } = {}) {
  const inbox = await loadInbox();
  const chosen = await chosenRepository(searchParams);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <RepositoryFilter
        requests={[...inbox.requests, ...inbox.repositoryRequests]}
        chosen={chosen}
        basePath="/"
      />
      {!isPondClear(inbox) && (
        <RequestQueue
          title="Waiting for you"
          requests={filterByRepository(inbox.requests, chosen)}
          progress={inbox.progress}
          error={inbox.requestsError}
          emptyMessage="Nothing is waiting for your review. Enjoy it."
        />
      )}
      {inbox.hasRepositories ? (
        <RequestQueue
          title="Open in your repositories"
          action={
            <span className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dependabot">Dependabot PRs</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/smartling">Smartling PRs</Link>
              </Button>
            </span>
          }
          requests={filterByRepository(inbox.repositoryRequests, chosen)}
          progress={inbox.progress}
          error={inbox.repositoryError}
          emptyMessage="No open pull requests in your repositories."
        />
      ) : (
        <p className="text-label text-fg-muted">
          Pick repositories in{" "}
          <Link href="/settings" className="text-fg underline underline-offset-4">
            Settings
          </Link>{" "}
          to see their open PRs here
        </p>
      )}
      <PostedList reviews={inbox.posted} />
      <BatchedSummary
        count={inbox.dependabotCount}
        change="dependency bump"
        botName="Dependabot"
        href="/dependabot"
      />
      <BatchedSummary
        count={inbox.smartlingCount}
        change="translation update"
        botName="Smartling"
        href="/smartling"
      />
    </div>
  );
}
