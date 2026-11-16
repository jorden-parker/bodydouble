"use client";

import { useState, type ReactNode } from "react";
import { EmptyNote, LoadingNote, PageBand, ProblemAlert } from "@/components/layout/page-shell";
import { Panel } from "@/components/neon/panels";
import { Stream } from "@/components/neon/stream";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dayKey } from "@/lib/metrics/buckets";
import {
  groupByDay,
  type OpenRow,
  type WorkReport,
  type WorkRow,
  type WorkTotals,
} from "@/lib/metrics/work";
import {
  detailParts,
  formatCycleTime,
  leadSentence,
  workMarkdown,
} from "@/lib/metrics/work-markdown";
import { REVIEW_STATUS_LABELS } from "@/lib/review-status";
import { plural } from "@/lib/text";
import { api as realApi, type TallyApi } from "../api";
import { formatDayMonth, formatLongDay } from "../dashboard/format";
import { useWorkLog } from "./use-work-log";
import { InlineMarkdown } from "@/components/inline-markdown";

const currentTime = () => new Date();

const BUTTON_CLASS = buttonVariants({ variant: "soft", size: "lg", className: "px-3" });
const SEPARATOR = " · ";
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_TALLY_MARKS = 5;

const PULL_REQUEST_STYLE = {
  label: "Merged",
  text: "text-ink-amber",
  dot: "bg-ink-amber",
};
const TICKET_STYLE = {
  label: "Done",
  text: "text-ink-mint",
  dot: "bg-ink-mint",
};

type WorkLogProps = { api?: TallyApi; now?: () => Date };

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      {label}
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-auto bg-background"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-surface p-4">
      <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[1.75rem] leading-none font-semibold tabular-nums break-words">
        {value}
      </dd>
    </div>
  );
}

function haveOrHas(count: number): string {
  return count === 1 ? "has" : "have";
}

function TotalsBlock({
  label,
  notes,
  children,
}: {
  label: string;
  notes: string[];
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-3">
      <dl className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-3">{children}</dl>
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  );
}

function PullRequestTotals({ totals }: { totals: WorkTotals }) {
  const notes =
    totals.prsWithoutSize === 0
      ? []
      : [`${plural(totals.prsWithoutSize, "PR")} ${haveOrHas(totals.prsWithoutSize)} no size data`];
  return (
    <TotalsBlock label="Pull requests" notes={notes}>
      <Stat label="PRs merged" value={String(totals.prsMerged)} />
      <Stat label="Lines changed" value={`+${totals.additions} −${totals.deletions}`} />
      <Stat label="Median cycle" value={formatCycleTime(totals.medianPrCycleMs)} />
    </TotalsBlock>
  );
}

function TicketTotals({ totals }: { totals: WorkTotals }) {
  const types = totals.ticketsByType.map(({ key, count }) => plural(count, key)).join(", ");
  const notes = [
    ...(types === "" ? [] : [types]),
    ...(totals.unestimatedTickets === 0
      ? []
      : [
          `${plural(totals.unestimatedTickets, "ticket")} ${haveOrHas(totals.unestimatedTickets)} no estimate`,
        ]),
  ];
  return (
    <TotalsBlock label="Tickets" notes={notes}>
      <Stat label="Tickets done" value={String(totals.ticketsCompleted)} />
      <Stat label="Points" value={String(totals.points)} />
      <Stat label="Median cycle" value={formatCycleTime(totals.medianTicketCycleMs)} />
    </TotalsBlock>
  );
}

function Totals({ totals }: { totals: WorkTotals }) {
  return (
    <section aria-label="Totals" className="grid grid-cols-1 gap-4">
      <PullRequestTotals totals={totals} />
      <TicketTotals totals={totals} />
    </section>
  );
}

function RowLink({ row }: { row: WorkRow | OpenRow }) {
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      className="text-sm leading-snug font-semibold underline-offset-4 hover:underline"
    >
      <InlineMarkdown text={row.title} />
    </a>
  );
}

function TimelineItem({ row }: { row: WorkRow }) {
  const style = row.kind === "pr_merged" ? PULL_REQUEST_STYLE : TICKET_STYLE;
  return (
    <li className="relative flex flex-col gap-1 py-3">
      <span
        aria-hidden="true"
        className={`absolute -left-[33px] top-5 size-4 rounded-full border-4 border-surface ${style.dot}`}
      />
      <span className={`font-mono text-xs tracking-wider uppercase ${style.text}`}>
        {style.label}
      </span>
      <RowLink row={row} />
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {detailParts(row).map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ul>
    </li>
  );
}

function TallyMarks({ count }: { count: number }) {
  const drawn = Math.min(count, MAX_TALLY_MARKS);
  return (
    <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
      <span role="img" aria-label={plural(count, "thing")} className="flex items-end gap-1">
        {Array.from({ length: drawn }, (_, index) => (
          <span key={index} className="h-4 w-[3px] rounded-sm bg-muted-foreground" />
        ))}
      </span>
      <span aria-hidden="true">{count}</span>
    </p>
  );
}

function OpenRowItem({ row }: { row: OpenRow }) {
  const status = row.reviewStatus === null ? [] : [REVIEW_STATUS_LABELS[row.reviewStatus]];
  const line = [`Opened ${formatLongDay(row.day)}`, row.repo, ...status].join(SEPARATOR);
  return (
    <li className="flex flex-col gap-1 py-3 transition-colors hover:bg-surface-2">
      <RowLink row={row} />
      <span className="text-sm text-muted-foreground">{line}</span>
    </li>
  );
}

function Timeline({ rows }: { rows: WorkRow[] }) {
  if (rows.length === 0) return <EmptyNote>A quiet stretch. Nothing here.</EmptyNote>;
  return (
    <div className="flex flex-col gap-6">
      {groupByDay(rows).map(({ day, rows: dayRows }) => (
        <section
          key={day}
          aria-labelledby={`day-${day}`}
          className="flex flex-col gap-1 border-l-2 border-line-soft pl-7"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`day-${day}`} className="text-sm font-semibold">
              {formatLongDay(day)}
            </h3>
            <TallyMarks count={dayRows.length} />
          </header>
          <ul className="flex flex-col divide-y divide-line-soft">
            {dayRows.map((row) => (
              <TimelineItem key={`${row.kind}-${row.externalId}`} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExportActions({ report }: { report: WorkReport }) {
  const markdown = workMarkdown(report);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CopyButton key={markdown} text={markdown} />
      <a
        href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
        download={`work-log-${report.from}-to-${report.to}.md`}
        className={BUTTON_CLASS}
      >
        Download .md
      </a>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy markdown");
  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => setLabel("Copied"),
      () => setLabel("Copy failed"),
    );
  return (
    <>
      <Button variant="neon" size="lg" onClick={copy}>
        {label}
      </Button>
      <span role="status" className="sr-only">
        {label === "Copy markdown" ? "" : label}
      </span>
    </>
  );
}

function WeekProgress({ dayIndex }: { dayIndex: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.8125rem] text-muted-foreground">Today is {WEEK_DAYS[dayIndex]}</p>
      <Stream
        steps={WEEK_DAYS.map((label) => ({ label }))}
        current={dayIndex}
        variant="small"
        label="Week progress"
      />
    </div>
  );
}

function Summary({ report, dayIndex }: { report: WorkReport; dayIndex: number }) {
  const shipped = report.totals.prsMerged + report.totals.ticketsCompleted;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{shipped} things shipped.</h2>
        <p className="text-muted-foreground">
          {leadSentence(report.totals)}, {formatDayMonth(report.from)} to{" "}
          {formatDayMonth(report.to)}
        </p>
      </div>
      <WeekProgress dayIndex={dayIndex} />
      <Totals totals={report.totals} />
      <ExportActions report={report} />
    </div>
  );
}

type OpenPullRequestsProps = { title: string; emptyNote: string; rows: OpenRow[] };

function OpenPullRequests({ title, emptyNote, rows }: OpenPullRequestsProps) {
  return (
    <Panel title={title}>
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {title} <span className="sr-only">(</span>
          <span className="rounded-md bg-surface-3 px-2 font-mono text-xs tabular-nums">
            {rows.length}
          </span>
          <span className="sr-only">)</span>
        </h2>
        {rows.length === 0 ? (
          <EmptyNote>{emptyNote}</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {rows.map((row) => (
              <OpenRowItem key={row.externalId} row={row} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function Report({ report, dayIndex }: { report: WorkReport; dayIndex: number }) {
  const timelineRows = [...report.prs, ...report.tickets].sort((first, second) =>
    second.occurredAt.localeCompare(first.occurredAt),
  );
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
      <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
        <Panel title="Summary">
          <Summary report={report} dayIndex={dayIndex} />
        </Panel>
        <OpenPullRequests
          title="Up for review"
          emptyNote="Nothing up for review."
          rows={report.upForReview}
        />
        <OpenPullRequests
          title="Drafts in progress"
          emptyNote="No drafts on the go."
          rows={report.drafts}
        />
      </div>
      <Panel title="Timeline">
        <h2 className="text-base font-semibold">Timeline</h2>
        <Timeline rows={timelineRows} />
      </Panel>
    </div>
  );
}

export function WorkLog({ api = realApi, now = currentTime }: WorkLogProps) {
  const { period, setPeriod, report, problem } = useWorkLog(api, now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = new Date(`${dayKey(now().toISOString(), timeZone)}T00:00:00Z`).getUTCDay();
  const dayIndex = (weekday + 6) % 7;

  return (
    <>
      <PageBand>
        <h1 className="page-title">Work log</h1>
        <div className="flex flex-wrap items-center gap-3">
          <DateField
            label="From"
            value={period.from}
            onChange={(from) => setPeriod({ ...period, from })}
          />
          <DateField
            label="To"
            value={period.to}
            onChange={(endDay) => setPeriod({ ...period, to: endDay })}
          />
        </div>
      </PageBand>
      <main id="main" className="app-main">
        <ProblemAlert messages={problem === null ? [] : [problem]} />
        {report ? <Report report={report} dayIndex={dayIndex} /> : null}
        {report === null && problem === null ? <LoadingNote /> : null}
      </main>
    </>
  );
}
