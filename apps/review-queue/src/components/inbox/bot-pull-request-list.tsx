import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { REVIEW_REQUEST_LIMIT } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import type { SnoozeUntil } from "@/lib/session/store";
import { type BotFilter, BotFilterMenu, botsShownBy, describeBotFilter } from "./bot-filter";
import { bumpFrom } from "./bump";
import type { Inbox } from "./inbox-data";
import {
  describeSnooze,
  isEntrySnoozed,
  type QueueEntry,
  type QueueSort,
  rankQueue,
} from "./queue";
import { QueueRow } from "./queue-row";
import { isInRepository, RepositoryFilter } from "./repository-filter";
import { SortMenu, sortParameterOf } from "./sort-menu";

function BumpChip({ entry }: { entry: QueueEntry }) {
  const bump = bumpFrom(entry.request.title);
  if (!bump) return null;
  return (
    <Badge variant="blue" className="font-mono">
      {bump.kind} {bump.from} → {bump.to}
    </Badge>
  );
}

export function BotRow({
  entry,
  snoozes,
  now,
}: {
  entry: QueueEntry;
  snoozes: Record<string, SnoozeUntil>;
  now: number;
}) {
  const until = snoozes[prKey(entry.request.ref)];
  const isSnoozed = isEntrySnoozed(entry, snoozes, now);
  return (
    <QueueRow
      now={now}
      entry={entry}
      isSnoozed={isSnoozed}
      status={
        isSnoozed && until ? (
          <Badge variant="secondary">{describeSnooze(until)}</Badge>
        ) : (
          <BumpChip entry={entry} />
        )
      }
    />
  );
}

export function BotPullRequestList({
  inbox,
  botFilter,
  chosen,
  sort,
}: {
  inbox: Pick<Inbox, "loadedAt" | "bots" | "snoozes" | "hasRepositories">;
  botFilter: NonNullable<BotFilter>;
  chosen: string | null;
  sort: QueueSort;
}) {
  const now = Date.parse(inbox.loadedAt);
  const searches = botsShownBy(botFilter).map((bot) => inbox.bots[bot]);
  const found = searches.flatMap((search) => search.entries);
  const errors = [...new Set(searches.flatMap((search) => search.error ?? []))];
  const entries = rankQueue(
    found.filter((entry) => isInRepository(entry.request, chosen)),
    sort,
  );
  const botNames = describeBotFilter(botFilter);
  const query = {
    repository: chosen ?? undefined,
    sort: sortParameterOf(sort),
    bots: botFilter,
  };
  return (
    <section aria-label="Open pull requests" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BotFilterMenu chosen={botFilter} query={query} />
        <RepositoryFilter
          requests={found.map((entry) => entry.request)}
          chosen={chosen}
          query={query}
        />
        <SortMenu sort={sort} hasEntriesToOrder={entries.length >= 2} query={query} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-heading">Open pull requests</h2>
        <Badge variant="blue">{entries.length}</Badge>
      </div>
      {errors.map((error) => (
        <div key={error} className="grid gap-2 rounded-xl border border-destructive/40 p-4 text-sm">
          <p>
            <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
            <code className="font-mono">gh</code>. Is it installed and logged in?
          </p>
          <p className="font-mono text-label text-fg-muted text-pretty">{error}</p>
        </div>
      ))}
      {found.length === 0 && errors.length === 0 && (
        <EmptyState>
          {inbox.hasRepositories
            ? `No ${botNames} pull requests are open. Nothing to update.`
            : `Pick repositories in Settings to see their ${botNames} PRs here.`}
        </EmptyState>
      )}
      {searches.some((search) => search.entries.length === REVIEW_REQUEST_LIMIT) && (
        <p className="text-label text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
      )}
      {entries.length > 0 && (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
          {entries.map((entry) => (
            <BotRow
              key={prKey(entry.request.ref)}
              entry={entry}
              snoozes={inbox.snoozes}
              now={now}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
