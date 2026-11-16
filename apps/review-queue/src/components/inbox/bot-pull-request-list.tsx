import { connection } from "next/server";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { type PullRequestAuthorship, REVIEW_REQUEST_LIMIT } from "@/lib/github/gh";
import { prKey } from "@/lib/pr-ref";
import { openPullRequests, sessionStore } from "@/lib/review/services";
import { savedRepositories } from "@/lib/settings/repository-settings";
import { bumpFrom } from "./bump";
import { failureMessage, buildQueueEntries, readSnoozes } from "./inbox-data";
import { isEntrySnoozed, rankQueue, type QueueEntry, describeSnooze } from "./queue";
import { QueueFrame } from "./queue-frame";
import { QueueRow } from "./queue-row";
import {
  chosenRepository,
  filterByRepository,
  RepositoryFilter,
  type RepositorySearchParams,
} from "./repository-filter";

type BotListProps = { searchParams?: RepositorySearchParams };

function BumpChip({ entry }: { entry: QueueEntry }) {
  const bump = bumpFrom(entry.request.title);
  if (!bump) return null;
  return (
    <Badge variant="blue" className="font-mono">
      {bump.kind} {bump.from} → {bump.to}
    </Badge>
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
  const shown = filterByRepository(outcome.requests, chosen);
  const entries = rankQueue(await buildQueueEntries(shown));
  const snoozes = readSnoozes(store);
  const loadedAt = new Date().toISOString();
  const now = Date.parse(loadedAt);
  return (
    <QueueFrame loadedAt={loadedAt}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-heading">Open pull requests</h2>
        <Badge variant="blue">{shown.length}</Badge>
      </div>
      {outcome.error ? (
        <div className="grid gap-2 rounded-xl border border-destructive/40 p-4 text-sm">
          <p>
            <span aria-hidden="true">🔌</span> Couldn&apos;t reach GitHub through{" "}
            <code className="font-mono">gh</code>. Is it installed and logged in?
          </p>
          <p className="font-mono text-label text-fg-muted text-pretty">{outcome.error}</p>
        </div>
      ) : outcome.requests.length === 0 ? (
        <EmptyState>
          {hasRepositories
            ? `No ${botName} pull requests are open. Nothing to update.`
            : `Pick repositories in Settings to see their ${botName} PRs here.`}
        </EmptyState>
      ) : (
        <>
          {outcome.requests.length === REVIEW_REQUEST_LIMIT && (
            <p className="text-label text-fg-muted">Showing the first {REVIEW_REQUEST_LIMIT}</p>
          )}
          <RepositoryFilter
            requests={outcome.requests}
            chosen={chosen}
            basePath={`/${authorship}`}
          />
          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
            {entries.map((entry) => {
              const key = prKey(entry.request.ref);
              const until = snoozes[key];
              const isSnoozed = isEntrySnoozed(entry, snoozes, now);
              return (
                <QueueRow
                  key={key}
                  now={now}
                  entry={entry}
                  status={
                    isSnoozed && until ? (
                      <Badge variant="secondary">{describeSnooze(until)}</Badge>
                    ) : (
                      <BumpChip entry={entry} />
                    )
                  }
                />
              );
            })}
          </ul>
        </>
      )}
    </QueueFrame>
  );
}

export function DependabotList({ searchParams }: BotListProps = {}) {
  return BotPullRequestList({ authorship: "dependabot", botName: "Dependabot", searchParams });
}

export function SmartlingList({ searchParams }: BotListProps = {}) {
  return BotPullRequestList({ authorship: "smartling", botName: "Smartling", searchParams });
}
