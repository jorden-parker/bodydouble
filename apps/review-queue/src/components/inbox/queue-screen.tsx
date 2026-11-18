import { ArrowRight, Coffee, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Otter } from "@/components/neon/otter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { REVIEW_REQUEST_LIMIT, type ReviewRequest } from "@/lib/github/gh";
import { gitHubPullRequestUrl, parsePullRequestRef, prKey } from "@/lib/pr-ref";
import { VERDICT_LABELS } from "@/lib/review/verdict-labels";
import type { RecentSubmission } from "@/lib/session/store";
import { BotFilterMenu, parseBotFilter } from "./bot-filter";
import { BotPullRequestList, BotRow } from "./bot-pull-request-list";
import { type BumpCounts, bumpCounts } from "./bump";
import { type Inbox, isPondClear, loadInbox } from "./inbox-data";
import {
  type QueueEntry,
  type QueueSort,
  layoutQueue,
  describeSnooze,
  parseQueueSort,
  rankQueue,
} from "./queue";
import { SortMenu, sortParameterOf } from "./sort-menu";
import { IdlePreparation } from "./idle-preparation";
import { QueueFrame } from "./queue-frame";
import { UpNext } from "./queue-hero";
import { QueueRow } from "./queue-row";
import {
  chosenRepository,
  isInRepository,
  RepositoryFilter,
  type RepositorySearchParams,
} from "./repository-filter";
import { relativeTime } from "./time";

function PondClear() {
  return (
    <section
      aria-labelledby="pond-clear-heading"
      className="grid justify-items-center gap-4 rounded-xl border border-line-soft bg-surface p-8 text-center"
    >
      <Otter size="large" isFloating />
      <div className="grid justify-items-center gap-2">
        <h2 id="pond-clear-heading" className="text-heading text-balance">
          Nothing waiting for review
        </h2>
        <p className="max-w-prose text-sm text-fg-muted">Enjoy the break.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <a href="#pr">
            Open any PR by URL <ArrowRight />
          </a>
        </Button>
        <Badge variant="amber">
          <Coffee />
          Stretch counts as productive
        </Badge>
      </div>
    </section>
  );
}

function GitHubFailure({ error }: { error: string }) {
  return (
    <Card className="gap-2 border-destructive/40">
      <p>
        <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
        <code className="font-mono">gh</code>. Is it installed and logged in?
      </p>
      <p className="font-mono text-label text-fg-muted text-pretty">{error}</p>
    </Card>
  );
}

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-eyebrow">
          {title} <span className="tabular-nums text-fg-muted">({count})</span>
        </h2>
        {hint}
      </div>
      <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
        {children}
      </ul>
    </section>
  );
}

function Fold({
  title,
  count,
  summary,
  children,
}: {
  title: string;
  count: number;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0 overflow-hidden rounded-xl border border-line-soft bg-card">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm font-medium">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-calm motion-safe:group-open:rotate-90"
        />
        <span className="whitespace-nowrap">{title}</span>
        <Badge variant="outline">{count}</Badge>
        <span className="text-label font-normal text-fg-muted text-pretty">{summary}</span>
      </summary>
      <div className="border-t border-line-soft">{children}</div>
    </details>
  );
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}`;
}

function describeBots(counts: BumpCounts, smartlingCount: number): string {
  const parts = [
    counts.patch > 0 && formatCount(counts.patch, "patch"),
    counts.minor > 0 && formatCount(counts.minor, "minor"),
    counts.major > 0 && formatCount(counts.major, "major"),
    counts.other > 0 && formatCount(counts.other, "other"),
    smartlingCount > 0 &&
      formatCount(
        smartlingCount,
        smartlingCount === 1 ? "translation update" : "translation updates",
      ),
  ].filter((part): part is string => typeof part === "string");
  return parts.length > 0 ? parts.join(" · ") : "Nothing to batch.";
}

function postedEntries(reviews: RecentSubmission[]): (QueueEntry & { review: RecentSubmission })[] {
  return reviews.flatMap((review) => {
    const ref = parsePullRequestRef(review.key);
    if (!ref) return [];
    const request: ReviewRequest = {
      ref,
      title: review.title ?? review.key,
      url: gitHubPullRequestUrl(ref),
      author: "",
      updatedAt: review.postedAt,
    };
    return [{ request, facts: null, progress: null, review }];
  });
}

function BotsFold({
  inbox,
  listed,
  chosen,
  sort,
  now,
}: {
  inbox: Pick<Inbox, "bots" | "snoozes">;
  listed: QueueEntry[];
  chosen: string | null;
  sort: QueueSort;
  now: number;
}) {
  const listedKeys = new Set(listed.map((entry) => prKey(entry.request.ref)));
  const isOnlyInBots = (entry: QueueEntry) =>
    isInRepository(entry.request, chosen) && !listedKeys.has(prKey(entry.request.ref));
  const dependabot = inbox.bots.dependabot.entries.filter(isOnlyInBots);
  const smartling = inbox.bots.smartling.entries.filter(isOnlyInBots);
  const bots = rankQueue([...dependabot, ...smartling], sort);
  return (
    <Fold
      title="Bots"
      count={bots.length}
      summary={describeBots(
        bumpCounts(dependabot.map((entry) => entry.request.title)),
        smartling.length,
      )}
    >
      {bots.length === 0 ? (
        <p className="px-4 py-3 text-label text-fg-muted">No bot pull requests are open.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {bots.map((entry) => (
            <BotRow
              key={prKey(entry.request.ref)}
              entry={entry}
              snoozes={inbox.snoozes}
              now={now}
            />
          ))}
        </ul>
      )}
    </Fold>
  );
}

function QueueSections({
  inbox,
  chosen,
  sort,
}: {
  inbox: Inbox;
  chosen: string | null;
  sort: QueueSort;
}) {
  const now = Date.parse(inbox.loadedAt);
  const entries = inbox.entries.filter((entry) => isInRepository(entry.request, chosen));
  const layout = layoutQueue(entries, inbox.snoozes, now, sort);
  const query = { repository: chosen ?? undefined, sort: sortParameterOf(sort) };
  const posted = postedEntries(inbox.posted);
  const latest = posted[0];
  return (
    <>
      {isPondClear(inbox) && <PondClear />}
      {[...new Set([inbox.requestsError, inbox.repositoryError])].map(
        (error) => error && <GitHubFailure key={error} error={error} />,
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotFilterMenu chosen={null} query={query} />
        <RepositoryFilter
          requests={inbox.entries.map((entry) => entry.request)}
          chosen={chosen}
          query={query}
        />
        <SortMenu sort={sort} hasEntriesToOrder={entries.length >= 2} query={query} />
      </div>
      {layout.upNext && (
        <UpNext entry={layout.upNext.entry} reason={layout.upNext.reason} now={now} />
      )}
      {inbox.isPrepareNextOn && layout.upNext && (
        <IdlePreparation pullRequestKey={prKey(layout.upNext.entry.request.ref)} />
      )}
      {layout.continued.length > 0 && (
        <Section title="Continue" count={layout.continued.length}>
          {layout.continued.map((entry) => (
            <QueueRow now={now} key={prKey(entry.request.ref)} entry={entry} />
          ))}
        </Section>
      )}
      {layout.newCommits.length > 0 && (
        <Section title="New commits since your review" count={layout.newCommits.length}>
          {layout.newCommits.map((entry) => (
            <QueueRow
              now={now}
              key={prKey(entry.request.ref)}
              entry={entry}
              status={<Badge variant="amber">New commits</Badge>}
            />
          ))}
        </Section>
      )}
      {layout.waiting.length > 0 && (
        <Section
          title="Waiting"
          count={layout.waiting.length}
          hint={
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-fg-muted">
              <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>↵</Kbd> open · <Kbd>s</Kbd> snooze ·{" "}
              <Kbd>e</Kbd> archive
            </p>
          }
        >
          {layout.waiting.map((entry) => (
            <QueueRow now={now} key={prKey(entry.request.ref)} entry={entry} />
          ))}
        </Section>
      )}
      {(inbox.waitingCount === REVIEW_REQUEST_LIMIT || inbox.isRepositoryListCapped) && (
        <p className="text-label text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
      )}
      {!inbox.hasRepositories && (
        <p className="text-label text-fg-muted">
          Pick repositories in{" "}
          <Link href="/settings" className="text-fg underline underline-offset-4">
            Settings
          </Link>{" "}
          to see their open PRs here.
        </p>
      )}
      <div className="flex min-w-0 flex-col gap-3">
        <Fold
          title="Later"
          count={layout.later.length}
          summary="snoozed until tomorrow or until new commits"
        >
          {layout.later.length === 0 ? (
            <p className="px-4 py-3 text-label text-fg-muted">Nothing snoozed.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {layout.later.map((entry) => {
                const until = inbox.snoozes[prKey(entry.request.ref)];
                return (
                  <QueueRow
                    now={now}
                    key={prKey(entry.request.ref)}
                    entry={entry}
                    isSnoozed
                    status={<Badge variant="secondary">{until && describeSnooze(until)}</Badge>}
                  />
                );
              })}
            </ul>
          )}
        </Fold>
        <BotsFold inbox={inbox} listed={entries} chosen={chosen} sort={sort} now={now} />
        {inbox.archived.length > 0 && (
          <Fold
            title="Archived"
            count={inbox.archived.length}
            summary="sessions you moved out of the way"
          >
            <ul className="divide-y divide-line-soft">
              {inbox.archived.map((entry) => (
                <QueueRow now={now} key={prKey(entry.request.ref)} entry={entry} isArchived />
              ))}
            </ul>
          </Fold>
        )}
        <Fold
          title="Posted"
          count={posted.length}
          summary={
            latest
              ? `last: ${VERDICT_LABELS[latest.review.event].toLowerCase()} ${prKey(latest.request.ref)}, ${relativeTime(latest.review.postedAt, now)}`
              : "No reviews posted yet."
          }
        >
          <ul className="divide-y divide-line-soft">
            {posted.map(({ review, ...entry }) => (
              <QueueRow
                now={now}
                key={`${review.key}-${review.reviewId}`}
                entry={entry}
                hasActions={false}
                status={<Badge variant="outline">{VERDICT_LABELS[review.event]}</Badge>}
              />
            ))}
          </ul>
        </Fold>
      </div>
    </>
  );
}

export async function QueueScreen({ searchParams }: { searchParams?: RepositorySearchParams }) {
  const inbox = await loadInbox();
  const chosen = await chosenRepository(searchParams);
  const sort = parseQueueSort((await searchParams)?.sort);
  const botFilter = parseBotFilter((await searchParams)?.bots);
  return (
    <QueueFrame loadedAt={inbox.loadedAt}>
      {botFilter ? (
        <BotPullRequestList inbox={inbox} botFilter={botFilter} chosen={chosen} sort={sort} />
      ) : (
        <QueueSections inbox={inbox} chosen={chosen} sort={sort} />
      )}
    </QueueFrame>
  );
}
