"use client";

import Link from "next/link";
import { RefreshCwIcon } from "lucide-react";
import {
  EmptyNote,
  LoadingNote,
  PageShell,
  ProblemAlert,
  SectionHeading,
} from "@/components/layout/page-shell";
import { Panel } from "@/components/neon/panels";
import { TallyMark } from "@/components/neon/tally-mark";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RANGES, type Range, type Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import { api as realApi, type TallyApi } from "../api";
import { DailyChart } from "./daily-chart";
import { formatSynced, RANGE_LABELS } from "./format";
import { StatLedger } from "./stat-ledger";
import { TicketCards } from "./ticket-cards";
import { useDashboard } from "./use-dashboard";

const currentTime = () => new Date();

type DashboardProps = { api?: TallyApi; now?: () => Date };

function isRange(value: unknown): value is Range {
  return RANGES.includes(value as Range);
}

function RangeSwitch({ range, onChange }: { range: Range; onChange: (range: Range) => void }) {
  return (
    <ToggleGroup
      aria-label="Time range"
      value={[range]}
      onValueChange={(selected) => {
        const [chosen] = selected;
        if (isRange(chosen)) onChange(chosen);
      }}
      spacing={0}
      className="rounded-md border border-line bg-surface p-0.5"
    >
      {RANGES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          size="sm"
          className="rounded-sm! px-3 text-muted-foreground aria-pressed:bg-surface-3 aria-pressed:text-foreground"
        >
          {RANGE_LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function needsSetup(settings: Settings | null): boolean {
  return settings !== null && settings.allowList.length === 0;
}

function Notices({ settings, problems }: { settings: Settings | null; problems: string[] }) {
  return (
    <>
      {needsSetup(settings) ? (
        <EmptyNote>
          No GitHub orgs or repos are counted yet.{" "}
          <Link
            href="/settings"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Choose them in settings
          </Link>
          .
        </EmptyNote>
      ) : null}
      <ProblemAlert messages={problems} />
    </>
  );
}

function Encouragement() {
  return (
    <p className="flex items-center gap-3 text-sm text-muted-foreground">
      <TallyMark size="small" />
      Tiny scribbles still add up. Go easy on yourself today.
    </p>
  );
}

function Report({
  summary,
  settings,
  problems,
}: {
  summary: Summary;
  settings: Settings | null;
  problems: string[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {needsSetup(settings) || problems.length > 0 ? (
        <section aria-label="Notices" className="flex flex-col gap-4">
          <Notices settings={settings} problems={problems} />
        </section>
      ) : null}
      <StatLedger summary={summary} />
      <Panel title="Your tickets" className="gap-6">
        <SectionHeading title="Your tickets" />
        <TicketCards
          open={summary.open}
          completedTickets={summary.completedTickets}
          range={summary.range}
        />
        <Encouragement />
      </Panel>
      <Panel title="Last four weeks" className="gap-6">
        <SectionHeading title="Last four weeks" />
        <DailyChart points={summary.daily} />
      </Panel>
    </div>
  );
}

export function Dashboard({ api = realApi, now = currentTime }: DashboardProps) {
  const { range, setRange, summary, settings, syncing, problems, sync } = useDashboard(api, now);

  return (
    <PageShell
      title="Your tally"
      actions={
        <>
          <RangeSwitch range={range} onChange={setRange} />
          <Button
            onClick={sync}
            disabled={syncing}
            focusableWhenDisabled
            size="lg"
            className="px-3"
          >
            <RefreshCwIcon data-icon="inline-start" className={syncing ? "animate-spin" : ""} />
            {syncing ? "Counting sheep…" : "Sync now"}
          </Button>
          <span role="status" className="text-sm text-muted-foreground">
            {syncing ? "Counting sheep…" : formatSynced(summary?.lastSyncedAt ?? null, now())}
          </span>
        </>
      }
    >
      {summary ? (
        <Report summary={summary} settings={settings} problems={problems} />
      ) : (
        <>
          <Notices settings={settings} problems={problems} />
          <LoadingNote />
        </>
      )}
    </PageShell>
  );
}
