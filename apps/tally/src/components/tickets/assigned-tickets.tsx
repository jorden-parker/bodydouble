"use client";

import { useState, type ReactNode } from "react";
import { EmptyNote, LoadingNote, ProblemAlert } from "@/components/layout/page-shell";
import { Panel } from "@/components/neon/panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayKey } from "@/lib/metrics/buckets";
import {
  ALL_STATUSES,
  filterByStatus,
  filterForState,
  filterForType,
  groupByStatus,
  listStatusOptions,
  type StatusGrouping,
  type StoryGroup,
} from "@/lib/metrics/status-groups";
import type { AssignedStory, WorkflowStateType } from "@/lib/store/assigned-stories";
import { InlineMarkdown } from "@/components/inline-markdown";
import { api as realApi, type TallyApi } from "../api";
import { formatLongDay } from "../dashboard/format";
import { useAssignedTickets } from "./use-assigned-tickets";

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const GROUPINGS: { value: StatusGrouping; label: string }[] = [
  { value: "state", label: "Workflow state" },
  { value: "type", label: "State type" },
  { value: "none", label: "Nothing" },
];

const STATE_TYPE_BADGE: Record<WorkflowStateType, "blue" | "amber" | "mint" | "neutral"> = {
  unstarted: "blue",
  started: "amber",
  done: "mint",
  backlog: "neutral",
};

function FilterPill({
  pressed,
  onPress,
  children,
}: {
  pressed: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground aria-pressed:text-foreground"
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  return (
    <span className="rounded-md bg-surface-3 px-1.5 font-mono text-xs tabular-nums">{value}</span>
  );
}

function StatusPills({
  stories,
  value,
  onChange,
}: {
  stories: AssignedStory[];
  value: string;
  onChange: (value: string) => void;
}) {
  const pill = (filter: string, label: string) => (
    <FilterPill key={filter} pressed={value === filter} onPress={() => onChange(filter)}>
      {label}
      <Count value={filterByStatus(stories, filter).length} />
    </FilterPill>
  );
  return (
    <div role="group" aria-label="Filter by workflow state" className="flex flex-wrap gap-3">
      {pill(ALL_STATUSES, "All statuses")}
      {listStatusOptions(stories).map((option) => (
        <div
          key={option.label}
          role="group"
          aria-label={option.label}
          className="flex flex-wrap gap-2"
        >
          {option.type === null
            ? null
            : pill(filterForType(option.type), `Any ${option.label.toLowerCase()}`)}
          {option.states.map((state) => pill(filterForState(state), state))}
        </div>
      ))}
    </div>
  );
}

function StoryCard({ story }: { story: AssignedStory }) {
  const badgeVariant = story.stateType === null ? "neutral" : STATE_TYPE_BADGE[story.stateType];
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">sc-{story.id}</span>
        <Badge variant={badgeVariant}>{story.state}</Badge>
        {story.storyType === null ? null : <Badge variant="neutral">{story.storyType}</Badge>}
        {story.estimate === null ? null : <Badge variant="neutral">{story.estimate} pt</Badge>}
      </div>
      <h3 className="text-base leading-snug font-semibold break-words">
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          <InlineMarkdown text={story.title} />
        </a>
      </h3>
      {story.completedAt === null ? null : (
        <p className="text-sm text-muted-foreground">
          Completed {formatLongDay(dayKey(story.completedAt, LOCAL_TIME_ZONE))}
        </p>
      )}
    </li>
  );
}

function LaneContent({ group }: { group: StoryGroup }) {
  return (
    <>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {group.label} <span className="sr-only">(</span>
        <span className="rounded-md bg-surface-3 px-1.5 font-mono text-xs tabular-nums">
          {group.stories.length}
        </span>
        <span className="sr-only">)</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {group.stories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </ul>
    </>
  );
}

function TicketLanes({ stories }: { stories: AssignedStory[] }) {
  const [status, setStatus] = useState(ALL_STATUSES);
  const [grouping, setGrouping] = useState<StatusGrouping>("state");
  const groups = groupByStatus(filterByStatus(stories, status), grouping);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Group by" className="flex flex-wrap gap-2">
          {GROUPINGS.map((option) => (
            <FilterPill
              key={option.value}
              pressed={grouping === option.value}
              onPress={() => setGrouping(option.value)}
            >
              {option.label}
            </FilterPill>
          ))}
        </div>
      </div>
      <StatusPills stories={stories} value={status} onChange={setStatus} />
      {groups.length === 0 ? (
        <EmptyNote>No tickets here. Try another status, or sync.</EmptyNote>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] lg:gap-6">
          {groups.map((group) => (
            <Panel key={group.key} title={group.label}>
              <LaneContent group={group} />
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}

export function AssignedTickets({ api = realApi }: { api?: TallyApi }) {
  const { stories, problems, syncing, sync } = useAssignedTickets(api);
  const total = stories?.length ?? 0;
  return (
    <main id="main" className="app-main">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="page-title flex items-center gap-2">
          Tickets <span className="sr-only">(</span>
          <span className="rounded-md bg-surface-3 px-2 font-mono text-sm tabular-nums">
            {total}
          </span>
          <span className="sr-only">)</span>
        </h1>
        <span role="status" className="sr-only">
          {syncing ? "Syncing tickets…" : ""}
        </span>
        <Button
          variant="neon"
          onClick={sync}
          disabled={syncing}
          focusableWhenDisabled
          className="ml-auto"
        >
          {syncing ? "Syncing tickets…" : "Sync tickets"}
        </Button>
      </header>
      <ProblemAlert messages={problems} />
      {stories === null ? (
        problems.length === 0 ? (
          <LoadingNote />
        ) : null
      ) : (
        <TicketLanes stories={stories} />
      )}
    </main>
  );
}
