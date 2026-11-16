import {
  CircleCheckIcon,
  EyeIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  type LucideIcon,
} from "lucide-react";
import type { PeriodTotals, Summary } from "@/lib/metrics/summary";
import { cn } from "cn";
import { deltaText } from "./format";

const PERIOD_FIGURES: {
  label: string;
  key: keyof PeriodTotals;
  icon: LucideIcon;
}[] = [
  { label: "PRs reviewed", key: "reviewed", icon: EyeIcon },
  { label: "PRs created", key: "created", icon: GitPullRequestIcon },
  { label: "PRs merged", key: "merged", icon: GitMergeIcon },
  { label: "Tickets completed", key: "completed", icon: CircleCheckIcon },
];

type FigureProps = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  isHero: boolean;
};

function Figure({ label, value, note, icon: Icon, isHero }: FigureProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line-soft bg-surface p-4 sm:p-6">
      <dt className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className={cn(
          "relative font-mono text-[2.5rem] leading-none font-semibold tracking-tight tabular-nums",
          isHero &&
            "after:absolute after:-bottom-3 after:left-0 after:h-0.5 after:w-12 after:rounded-full after:bg-app-gradient",
        )}
      >
        {value}
      </dd>
      <dd className="text-[0.8125rem] text-muted-foreground">{note}</dd>
    </div>
  );
}

export function StatLedger({ summary }: { summary: Summary }) {
  return (
    <section aria-label="This period">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {PERIOD_FIGURES.map(({ label, key, icon }, index) => (
          <Figure
            key={key}
            label={label}
            value={summary.current[key]}
            note={deltaText(summary.current[key], summary.previous[key], summary.range)}
            icon={icon}
            isHero={index === 0}
          />
        ))}
      </dl>
    </section>
  );
}
