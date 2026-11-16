"use client";

import "./dashboard.css";
import Link from "next/link";
import { RefreshCwIcon } from "lucide-react";
import {
  LoadingNote,
  PageShell,
  ProblemAlert,
  SectionHeading,
} from "@/components/layout/page-shell";
import { Panel, Panels } from "@/components/neon/panels";
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
      className="rounded-lg border border-line-soft bg-surface p-1"
    >
      {RANGES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          size="sm"
          className="rounded-md! px-4 text-muted-foreground aria-pressed:bg-surface-3 aria-pressed:text-foreground"
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

function SetupNote() {
  return (
    <p className="rounded-lg border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
      No GitHub orgs or repos are counted yet.{" "}
      <Link href="/settings" className="font-medium text-foreground underline underline-offset-4">
        Choose them in settings
      </Link>
      .
    </p>
  );
}

function Notices({ settings, problems }: { settings: Settings | null; problems: string[] }) {
  return (
    <>
      {needsSetup(settings) ? <SetupNote /> : null}
      <ProblemAlert messages={problems} />
    </>
  );
}

function Encouragement() {
  return (
    <p className="flex items-center gap-3 self-start rounded-pill border border-dashed border-line bg-tint-violet px-4 py-2 text-sm font-semibold text-foreground">
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
    <Panels className="dashboard-panels">
      {needsSetup(settings) || problems.length > 0 ? (
        <Panel title="Notices" className="dashboard-notices">
          <Notices settings={settings} problems={problems} />
        </Panel>
      ) : null}
      <Panel title="Overview" className="dashboard-overview">
        <StatLedger summary={summary} />
      </Panel>
      <Panel
        title="Your Tickets"
        className="dashboard-tickets gap-5 rounded-xl border border-line-soft bg-surface p-6 shadow-lift"
      >
        <SectionHeading title="Your Tickets" />
        <TicketCards
          open={summary.open}
          completedTickets={summary.completedTickets}
          range={summary.range}
        />
        <Encouragement />
      </Panel>
      <Panel
        title="The Last Four Weeks, in Scribbles"
        className="dashboard-chart gap-5 rounded-xl border border-line-soft bg-surface p-6 shadow-lift"
      >
        <SectionHeading title="The Last Four Weeks, in Scribbles" />
        <DailyChart points={summary.daily} />
      </Panel>
    </Panels>
  );
}

export function Dashboard({ api = realApi, now = currentTime }: DashboardProps) {
  const { range, setRange, summary, settings, syncing, problems, sync } = useDashboard(api, now);

  return (
    <PageShell
      title={
        <>
          Hey There. <span className="text-neon-tally">Here&apos;s Your Tally.</span>
        </>
      }
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
