"use client";

import {
  Archive,
  Bell,
  Check,
  Clock,
  ExternalLink,
  GitCommitHorizontal,
  LoaderCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PullRequestFacts, ReviewRequest } from "@/lib/github/gh";
import { prKey, prPath } from "@/lib/pr-ref";
import type { PauseState, ProgressSummary } from "@/lib/session/store";
import { initialsOf, type QueueEntry, sizeOf } from "./queue";
import { useSessionChange } from "./use-session-change";
import { relativeTime } from "./time";

type Change = ReturnType<typeof useSessionChange>["change"];

function CheckChip({ state }: { state: PullRequestFacts["checks"] }) {
  if (state === "passing") {
    return (
      <Badge variant="mint">
        <Check aria-hidden="true" />
        Checks pass
      </Badge>
    );
  }
  if (state === "running") {
    return (
      <Badge variant="amber">
        <LoaderCircle aria-hidden="true" />
        Checks running
      </Badge>
    );
  }
  if (state === "failing") {
    return (
      <Badge variant="coral">
        <X aria-hidden="true" />
        Checks failing
      </Badge>
    );
  }
  return null;
}

function formatProgress(progress: ProgressSummary | null): string | null {
  if (!progress) return null;
  if (progress.totalSteps === null) return `${progress.doneCount} done`;
  const current = Math.min(progress.doneCount + 1, progress.totalSteps);
  return `Step ${current} of ${progress.totalSteps}`;
}

function PauseNote({ pause, now }: { pause: PauseState; now: number }) {
  const note = pause.note.trim();
  return (
    <span className="flex flex-wrap items-center gap-2 text-label">
      <span className="rounded-sm bg-callout px-2 py-0.5 text-callout-foreground text-pretty">
        {note ? `You were about to: ${note}` : "Paused"}
      </span>
      <span className="whitespace-nowrap text-fg-muted">{relativeTime(pause.at, now)}</span>
    </span>
  );
}

function Avatar({ login }: { login: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full border border-line-soft bg-surface text-label font-medium text-fg-muted"
    >
      {initialsOf(login)}
    </span>
  );
}

export function ReferenceLine({
  request,
  createdAt,
  now,
}: {
  request: ReviewRequest;
  createdAt: string | null;
  now: number;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-label text-fg-muted">
      <span className="max-w-full truncate font-mono text-fg">{prKey(request.ref)}</span>
      {request.author && <span className="whitespace-nowrap">by {request.author}</span>}
      {createdAt && (
        <>
          <time dateTime={createdAt} className="whitespace-nowrap">
            created {relativeTime(createdAt, now)}
          </time>
          <time dateTime={request.updatedAt} className="whitespace-nowrap">
            updated {relativeTime(request.updatedAt, now)}
          </time>
        </>
      )}
    </span>
  );
}

function RowIdentity({ entry, now }: { entry: QueueEntry; now: number }) {
  const { request, facts, progress } = entry;
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-sm font-medium text-pretty">
        <InlineMarkdown text={request.title} />
      </span>
      {entry.intent && (
        <span className="text-label text-fg-muted text-pretty">
          Model&apos;s guess: <InlineMarkdown text={entry.intent} />
        </span>
      )}
      <ReferenceLine request={request} createdAt={facts?.createdAt ?? null} now={now} />
      {progress?.pause && <PauseNote pause={progress.pause} now={now} />}
    </span>
  );
}

function RowActions({
  entry,
  change,
  isPending,
  hasActions,
  isArchived,
  isSnoozed,
}: {
  entry: QueueEntry;
  change: Change;
  isPending: boolean;
  hasActions: boolean;
  isArchived: boolean;
  isSnoozed: boolean;
}) {
  const { request, facts, progress } = entry;
  const reference = prKey(request.ref);
  const canSnooze = hasActions && !isSnoozed;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {isSnoozed && (
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          aria-label={`Wake ${reference}`}
          data-queue-action="wake"
          disabled={isPending}
          onClick={() => change({ type: "wake" })}
        >
          <Bell aria-hidden="true" />
          Wake
        </Button>
      )}
      {canSnooze && facts && (
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Snooze until new commits"
          aria-label={`Snooze ${reference} until new commits`}
          data-queue-action="snooze-commits"
          disabled={isPending}
          onClick={() =>
            change({ type: "snooze", until: { kind: "new-commits", headSha: facts.headSha } })
          }
        >
          <GitCommitHorizontal />
        </HintButton>
      )}
      {canSnooze && (
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint="Snooze until tomorrow"
          shortcut="s"
          aria-label={`Snooze ${reference} until tomorrow`}
          data-queue-action="snooze"
          disabled={isPending}
          onClick={() => change({ type: "snooze", until: { kind: "tomorrow" } })}
        >
          <Clock />
        </HintButton>
      )}
      {hasActions && progress && (
        <HintButton
          variant="ghost"
          size="icon-sm"
          hint={isArchived ? "Restore" : "Move to Archived"}
          shortcut={isArchived ? undefined : "e"}
          aria-label={`${isArchived ? "Restore" : "Archive"} ${reference}`}
          data-queue-action={isArchived ? "restore" : "archive"}
          disabled={isPending}
          onClick={() => change({ type: isArchived ? "unarchive" : "archive" })}
        >
          <Archive />
        </HintButton>
      )}
      <HintButton
        variant="ghost"
        size="icon-sm"
        hint="Open on GitHub"
        aria-label={`Open ${reference} on GitHub`}
        asChild
      >
        <a href={request.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink />
        </a>
      </HintButton>
    </span>
  );
}

function RowChips({
  entry,
  status,
  note,
  failure,
}: {
  entry: QueueEntry;
  status?: ReactNode;
  note?: ReactNode;
  failure: string | null;
}) {
  const { facts, progress } = entry;
  const label = formatProgress(progress);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 pl-11">
      {facts && (
        <Badge variant="outline">
          <span className="sr-only">Size </span>
          {sizeOf(facts)}
        </Badge>
      )}
      {facts && <CheckChip state={facts.checks} />}
      {label && <Badge variant="blue">{label}</Badge>}
      {status}
      {note}
      {failure && <span className="text-label text-destructive">{failure}</span>}
    </div>
  );
}

export function QueueRow({
  entry,
  status,
  note,
  hasActions = true,
  isArchived = false,
  isSnoozed = false,
  now,
}: {
  entry: QueueEntry;
  status?: ReactNode;
  note?: ReactNode;
  hasActions?: boolean;
  isArchived?: boolean;
  isSnoozed?: boolean;
  now: number;
}) {
  const { request } = entry;
  const { change, isPending, failure } = useSessionChange(request.ref);
  return (
    <li
      data-queue-row
      data-queue-key={prKey(request.ref)}
      className="group grid min-w-0 gap-2 px-4 py-3 transition-colors duration-calm hover:bg-surface-2 has-[a:focus-visible]:bg-surface-2"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Link
          href={prPath(request.ref)}
          data-queue-open
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-none"
        >
          {request.author && <Avatar login={request.author} />}
          <RowIdentity entry={entry} now={now} />
        </Link>
        <RowActions
          entry={entry}
          change={change}
          isPending={isPending}
          hasActions={hasActions}
          isArchived={isArchived}
          isSnoozed={isSnoozed}
        />
      </div>
      <RowChips entry={entry} status={status} note={note} failure={failure} />
    </li>
  );
}
