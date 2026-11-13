import { CircleCheckIcon, GitMergeIcon, GitPullRequestIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { SectionHeading } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import type { PeriodTotals, Summary } from "@/lib/metrics/summary";
import { deltaText, RANGE_UNITS } from "./format";
import { TallyMarks } from "./tally-marks";

type Tone = { border: string; icon: string };

const TONES: Record<"blue" | "mint" | "violet", Tone> = {
  blue: { border: "border-t-neon-blue", icon: "bg-tint-blue text-ink-blue" },
  mint: { border: "border-t-neon-mint", icon: "bg-tint-mint text-ink-mint" },
  violet: { border: "border-t-neon-violet", icon: "bg-tint-violet text-ink-violet" },
};

const PERIOD_FIGURES: {
  label: string;
  key: keyof PeriodTotals;
  icon: LucideIcon;
  tone: keyof typeof TONES;
}[] = [
  { label: "PRs Created", key: "created", icon: GitPullRequestIcon, tone: "blue" },
  { label: "PRs Merged", key: "merged", icon: GitMergeIcon, tone: "mint" },
  { label: "Tickets Completed", key: "completed", icon: CircleCheckIcon, tone: "violet" },
];

type FigureProps = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
};

function Figure({ label, value, note, icon: Icon, tone }: FigureProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-x-3 overflow-hidden rounded-xl border border-line-soft bg-surface p-3 shadow-lift border-t-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-4",
        TONES[tone].border,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "hidden row-span-3 place-items-center rounded-md sm:grid size-9",
          TONES[tone].icon,
        )}
      >
        <Icon className="size-5" />
      </span>
      <dt className="text-sm leading-tight font-bold text-muted-foreground">{label}</dt>
      <dd className="font-display text-2xl leading-tight font-semibold sm:text-3xl">{value}</dd>
      <dd className="text-xs text-muted-foreground sm:text-sm">{note}</dd>
    </div>
  );
}

function Hero({ summary }: { summary: Summary }) {
  const { reviewed } = summary.current;
  return (
    <section
      aria-label="Reviewed this period"
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-soft bg-surface p-4 shadow-glow-pink sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <SectionHeading title="PRs Reviewed" />
          <Badge variant="mint">
            {deltaText(reviewed, summary.previous.reviewed, summary.range)}
          </Badge>
        </div>
        <p className="flex items-baseline gap-3">
          <span className="font-display text-5xl leading-none font-semibold text-neon-tally sm:text-6xl">
            {reviewed}
          </span>
          <span className="text-muted-foreground">{RANGE_UNITS[summary.range]}</span>
        </p>
      </div>
      <TallyMarks
        count={reviewed}
        label={`${reviewed} PRs reviewed`}
        className="hidden h-16 w-auto sm:block"
      />
    </section>
  );
}

export function StatLedger({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-col gap-4">
      <Hero summary={summary} />
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        {PERIOD_FIGURES.map(({ label, key, icon, tone }) => (
          <Figure
            key={key}
            label={label}
            value={summary.current[key]}
            note={deltaText(summary.current[key], summary.previous[key], summary.range)}
            icon={icon}
            tone={tone}
          />
        ))}
      </dl>
    </div>
  );
}
