import { ExternalLink, GitPullRequest } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REVIEW_REQUEST_LIMIT, type ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import { openPullRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type { PauseState, ProgressSummary } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";
import { failureMessage } from "./inbox-list";
import { orderQueue, type QueueEntry } from "./queue";

const BUMP_TITLE = /\bbump\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)/i;

function bumpFrom(title: string): { packageName: string; from: string; to: string } | null {
  const match = BUMP_TITLE.exec(title);
  if (!match) return null;
  return { packageName: match[1], from: match[2], to: match[3] };
}

function PausedNote({ pause }: { pause: PauseState }) {
  const note = pause.note.trim();
  return (
    <p className="flex flex-wrap items-center gap-s-2 text-sm">
      <span className="rounded-pill bg-tint-amber px-s-3 py-0.5 font-semibold">
        {note ? `You were about to: ${note}` : "Paused"}
      </span>
      <span className="text-fg-muted">{relativeTime(pause.at)}</span>
    </p>
  );
}

function DependabotRow({ entry }: { entry: QueueEntry }) {
  const { request, progress } = entry;
  const bump = bumpFrom(request.title);
  const reference = prKey(request.ref);
  return (
    <li className="flex flex-wrap items-center gap-x-s-4 gap-y-s-3 border-t border-line-soft py-s-4">
      <div className="grid min-w-0 flex-1 basis-72 gap-s-2">
        <p className="flex flex-wrap items-center gap-x-s-3 gap-y-s-1">
          <span className="font-mono text-sm text-fg-faint">
            {request.ref.owner}/{request.ref.repo} #{request.ref.number}
          </span>
          {bump ? (
            <>
              <span className="text-lg font-semibold">{bump.packageName}</span>
              <Badge variant="blue" className="font-mono">
                {bump.from} → {bump.to}
              </Badge>
            </>
          ) : (
            <span className="text-lg font-semibold">
              <InlineMarkdown text={request.title} />
            </span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-s-3 gap-y-s-1 text-sm text-fg-muted">
          <span>by {request.author}</span>
          <span>updated {relativeTime(request.updatedAt)}</span>
          {request.isDraft && <span>draft</span>}
          {entry.movedSinceVisit && <Badge variant="amber">Activity since your visit</Badge>}
        </p>
        {progress?.pause && <PausedNote pause={progress.pause} />}
      </div>
      <div className="flex flex-none flex-wrap items-center gap-s-2">
        {progress ? (
          <Badge variant="mint">Resume, {progress.doneCount} steps done</Badge>
        ) : (
          <Badge variant="outline">Not started</Badge>
        )}
        <Button variant="soft" asChild>
          <Link href={prPath(request.ref)}>
            {progress ? "Resume" : "Review"}
            <span className="sr-only">: {request.title}</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <a
            href={request.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${reference} on GitHub`}
          >
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
    </li>
  );
}

function DependabotRows({
  requests,
  progress,
}: {
  requests: ReviewRequest[];
  progress: Record<string, ProgressSummary>;
}) {
  const entries = orderQueue(requests, progress);
  const started = entries.filter((entry) => entry.progress);
  const notStarted = entries.filter((entry) => !entry.progress);
  return (
    <ul className="flex flex-col px-s-5">
      {started.map((entry) => (
        <DependabotRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
      {started.length > 0 && notStarted.length > 0 && (
        <li className="border-t border-line-soft py-s-3 text-sm font-semibold text-fg-muted">
          Not started
        </li>
      )}
      {notStarted.map((entry) => (
        <DependabotRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
    </ul>
  );
}

export async function DependabotList() {
  await connection();
  const store = sessionStore();
  const outcome = await openPullRequests("dependabot").then(
    (requests) => ({ requests, error: null }),
    (failure: unknown) => ({ requests: [], error: failureMessage(failure) }),
  );
  const hasRepositories = savedRepositories(store).length > 0;
  const progress = store.progressSummaries(outcome.requests.map((request) => prKey(request.ref)));
  const count = outcome.requests.length;
  return (
    <div className="grid gap-s-4">
      <div className="flex flex-wrap items-center gap-s-3">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-md bg-tint-blue text-ink-blue"
        >
          <GitPullRequest className="size-[22px]" />
        </span>
        <h2 className="font-display text-xl font-semibold">Open Pull Requests</h2>
        <Badge variant="blue">{count}</Badge>
      </div>
      {outcome.error ? (
        <div className="grid gap-s-2 rounded-md border border-ink-coral/40 p-s-4 text-sm">
          <p>
            <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
            <code className="font-mono">gh</code>. Is it installed and logged in?
          </p>
          <p className="font-mono text-fg-muted">{outcome.error}</p>
        </div>
      ) : count === 0 ? (
        <EmptyState emoji="🌴">
          {hasRepositories ? (
            "No Dependabot pull requests are open. Nothing to update."
          ) : (
            <>
              Pick repositories in{" "}
              <Link href="/settings" className="text-fg underline underline-offset-4">
                Settings
              </Link>{" "}
              to see their Dependabot PRs here.
            </>
          )}
        </EmptyState>
      ) : (
        <>
          {count === REVIEW_REQUEST_LIMIT && (
            <p className="text-sm text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
          )}
          <DependabotRows requests={outcome.requests} progress={progress} />
        </>
      )}
    </div>
  );
}
