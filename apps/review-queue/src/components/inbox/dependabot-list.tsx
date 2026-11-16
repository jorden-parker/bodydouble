import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { EmptyState } from "@/components/common/empty-state";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  REVIEW_REQUEST_LIMIT,
  type PullRequestAuthorship,
  type ReviewRequest,
} from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import { openPullRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import type { PauseState, ProgressSummary } from "@/lib/session/store";
import { relativeTime } from "./in-progress-list";
import { failureMessage } from "./inbox-list";
import { orderQueue, type QueueEntry } from "./queue";
import {
  chosenRepository,
  filterByRepository,
  RepositoryFilter,
  type RepositorySearchParams,
} from "./repository-filter";

type BotListProps = { searchParams?: RepositorySearchParams };

const BUMP_TITLE = /\bbump\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)/i;

function bumpFrom(title: string): { packageName: string; from: string; to: string } | null {
  const match = BUMP_TITLE.exec(title);
  if (!match) return null;
  return { packageName: match[1], from: match[2], to: match[3] };
}

function PausedNote({ pause }: { pause: PauseState }) {
  const note = pause.note.trim();
  return (
    <p className="flex flex-wrap items-center gap-2 text-label">
      <span className="rounded-sm bg-tint-amber px-2 py-0.5 font-medium">
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
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <div className="grid min-w-0 flex-1 basis-72 gap-2">
        <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-label text-fg-muted wrap-anywhere">
            {request.ref.owner}/{request.ref.repo} #{request.ref.number}
          </span>
          {bump ? (
            <>
              <span className="text-sm font-medium wrap-anywhere">{bump.packageName}</span>
              <Badge variant="blue" className="font-mono">
                {bump.from} → {bump.to}
              </Badge>
            </>
          ) : (
            <span className="text-sm font-medium wrap-anywhere">
              <InlineMarkdown text={request.title} />
            </span>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label text-fg-muted">
          <span>by {request.author}</span>
          <span>updated {relativeTime(request.updatedAt)}</span>
          {entry.movedSinceVisit && <Badge variant="amber">Activity since your visit</Badge>}
        </p>
        {progress?.pause && <PausedNote pause={progress.pause} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
    <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
      {started.map((entry) => (
        <DependabotRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
      {started.length > 0 && notStarted.length > 0 && (
        <li className="bg-surface-2 px-4 py-2 text-label font-medium text-fg-muted">Not started</li>
      )}
      {notStarted.map((entry) => (
        <DependabotRow key={prKey(entry.request.ref)} entry={entry} />
      ))}
    </ul>
  );
}

async function BotPullRequestList({
  authorship,
  botName,
  searchParams,
}: BotListProps & { authorship: PullRequestAuthorship; botName: string }) {
  await connection();
  const store = sessionStore();
  const chosen = await chosenRepository(searchParams);
  const outcome = await openPullRequests(authorship).then(
    (requests) => ({ requests, error: null }),
    (failure: unknown) => ({ requests: [], error: failureMessage(failure) }),
  );
  const hasRepositories = savedRepositories(store).length > 0;
  const progress = store.progressSummaries(outcome.requests.map((request) => prKey(request.ref)));
  const count = outcome.requests.length;
  const shownRequests = filterByRepository(outcome.requests, chosen);
  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-heading">Open pull requests</h2>
        <Badge variant="blue">{shownRequests.length}</Badge>
      </div>
      {outcome.error ? (
        <div className="grid gap-2 rounded-xl border border-ink-coral/40 p-4 text-sm">
          <p>
            <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
            <code className="font-mono">gh</code>. Is it installed and logged in?
          </p>
          <p className="font-mono text-label text-fg-muted wrap-anywhere">{outcome.error}</p>
        </div>
      ) : count === 0 ? (
        <EmptyState emoji="🌴">
          {hasRepositories ? (
            `No ${botName} pull requests are open. Nothing to update.`
          ) : (
            <>
              Pick repositories in{" "}
              <Link href="/settings" className="text-fg underline underline-offset-4">
                Settings
              </Link>{" "}
              to see their {botName} PRs here.
            </>
          )}
        </EmptyState>
      ) : (
        <>
          {count === REVIEW_REQUEST_LIMIT && (
            <p className="text-label text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
          )}
          <RepositoryFilter
            requests={outcome.requests}
            chosen={chosen}
            basePath={`/${authorship}`}
          />
          <DependabotRows requests={shownRequests} progress={progress} />
        </>
      )}
    </div>
  );
}

export function DependabotList({ searchParams }: BotListProps = {}) {
  return BotPullRequestList({ authorship: "dependabot", botName: "Dependabot", searchParams });
}

export function SmartlingList({ searchParams }: BotListProps = {}) {
  return BotPullRequestList({ authorship: "smartling", botName: "Smartling", searchParams });
}
