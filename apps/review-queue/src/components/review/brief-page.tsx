"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { Callout } from "@/components/common/callout";
import { InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { PathLabel } from "@/components/common/path-label";
import { PrDescription } from "@/components/common/pr-description";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExplanationProgress } from "@/lib/review/explanation-service";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { Hotspot, PullRequestRef, Severity } from "@/lib/types";
import { fetchExplanationProgress } from "./api";
import type { DisplayHotspot } from "./hotspot-list";
import { LinkedIssues } from "./linked-issues";
import { suggestedDifference, suggestedOrderIds } from "./step-order";
import type { OrientationState } from "./use-review";
import type { Workspace } from "./use-workspace";

type BriefPageProps = {
  review: ReviewPayload;
  session: Session;
  builtInStepIds: string[];
  orientation: OrientationState;
  workspace: Workspace;
  onRetryOrientation: () => void;
};

const RISK_STYLES = {
  low: "text-add-foreground",
  medium: "text-severity-medium",
  high: "text-severity-high",
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_LABELS: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEVERITY_STYLES: Record<Severity, string> = {
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
};

const PROGRESS_INTERVAL_MS = 3000;

function useExplanationProgress(
  pullRequest: PullRequestRef,
  headSha: string,
): ExplanationProgress | null {
  const [progress, setProgress] = useState<ExplanationProgress | null>(null);
  useEffect(() => {
    function readProgress() {
      if (document.visibilityState === "hidden") return;
      fetchExplanationProgress(pullRequest, headSha).then(setProgress, () => undefined);
    }
    readProgress();
    const timer = window.setInterval(readProgress, PROGRESS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pullRequest, headSha]);
  return progress;
}

function ReadingProgress({
  pullRequest,
  headSha,
}: {
  pullRequest: PullRequestRef;
  headSha: string;
}) {
  const progress = useExplanationProgress(pullRequest, headSha);
  const current = progress && progress.explained < progress.total ? progress.explained + 1 : null;
  const status = !progress
    ? "Local model is reading the steps."
    : current === null
      ? "Local model is putting the steps together."
      : `Local model is reading step ${current} of ${progress.total}.`;
  return (
    <p role="status" className="text-sm text-muted-foreground text-pretty">
      {status} You can start now.
    </p>
  );
}

function ModelSummary({
  review,
  orientation,
  onRetry,
}: {
  review: ReviewPayload;
  orientation: OrientationState;
  onRetry: () => void;
}) {
  if (orientation.status === "disabled") return null;
  if (orientation.status === "loading") {
    return <ReadingProgress pullRequest={review.pr.ref} headSha={review.headSha} />;
  }
  if (orientation.status === "error") {
    return (
      <Callout role="status" className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 text-pretty">
          Local model unavailable ({orientation.message}). Using heuristics only.
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </Callout>
    );
  }
  const { summary, intent, risk } = orientation.orientation;
  return (
    <div className="flex flex-col gap-2 text-pretty">
      <div className="flex items-start gap-2 text-base">
        <Sparkles aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
        <Markdown text={summary} className="flex flex-col gap-1.5" />
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Why:</span> <InlineMarkdown text={intent} />
      </p>
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="text-muted-foreground">Risk:</span>
        <span className={cn("font-medium", RISK_STYLES[risk])}>{risk}</span>
        <span className="text-xs text-muted-foreground">The model&apos;s guess, unverified.</span>
      </p>
    </div>
  );
}

function Facts({ review }: { review: ReviewPayload }) {
  const facts = [
    { value: `${review.steps.length}`, label: "steps" },
    { value: `${review.files.length}`, label: "files" },
    { value: `+${review.pr.additions} −${review.pr.deletions}`, label: "lines" },
    { value: `~${review.estimateMinutes} min`, label: "to read" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {facts.map((fact) => (
        <li key={fact.label} className="flex flex-col gap-1 rounded-lg border border-line-soft p-3">
          <span className="whitespace-nowrap text-heading tabular-nums">{fact.value}</span>
          <span className="text-sm text-muted-foreground">{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}

function OrderSuggestion({
  review,
  session,
  builtInStepIds,
  orientation,
  workspace,
}: BriefPageProps) {
  if (session.stepOrder !== null) {
    return (
      <Callout className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 text-pretty">Reading in the model&apos;s order.</span>
        <Button size="sm" variant="ghost" onClick={() => workspace.setStepOrder(null)}>
          Use the built-in order
        </Button>
      </Callout>
    );
  }
  const suggested = suggestedOrderIds(orientation);
  const difference = suggested ? suggestedDifference(builtInStepIds, suggested) : null;
  if (!suggested || !difference) return null;
  const titleOf = (id: string) => review.steps.find((step) => step.id === id)?.title ?? id;
  return (
    <Callout className="flex flex-wrap items-center justify-between gap-3">
      <span className="min-w-0 text-pretty">
        The model suggests reading {titleOf(difference.suggested)} before{" "}
        {titleOf(difference.builtIn)}.
      </span>
      <Button size="sm" variant="outline" onClick={() => workspace.setStepOrder(suggested)}>
        Use that order
      </Button>
    </Callout>
  );
}

function TopHotspot({ hotspot, workspace }: { hotspot: DisplayHotspot; workspace: Workspace }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => workspace.goTo({ path: hotspot.path, line: hotspot.line })}
        className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 text-left hover:bg-muted"
      >
        <span
          className={cn("whitespace-nowrap text-sm font-medium", SEVERITY_STYLES[hotspot.severity])}
        >
          {SEVERITY_LABELS[hotspot.severity]}
        </span>
        <span className="min-w-0 flex-1 text-pretty text-sm">{hotspot.title}</span>
        <span className="min-w-0 max-w-full">
          <PathLabel path={hotspot.path} line={hotspot.line} />
        </span>
      </button>
    </li>
  );
}

function LookOutFor({ hotspots, workspace }: { hotspots: Hotspot[]; workspace: Workspace }) {
  const top = [...hotspots]
    .sort((first, second) => SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity])
    .slice(0, 3);
  return (
    <section aria-labelledby="look-out-heading" className="flex flex-col gap-2">
      <h3 id="look-out-heading" className="text-eyebrow">
        Look out for
      </h3>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing unusual spotted. Still read carefully.
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-line-soft p-1">
          {top.map((hotspot) => (
            <TopHotspot key={hotspot.id} hotspot={hotspot} workspace={workspace} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BriefPage(props: BriefPageProps) {
  const { review, session, workspace } = props;
  const risk = props.orientation.status === "ready" ? props.orientation.orientation.risk : null;
  const first = review.steps[0];
  return (
    <article aria-labelledby="brief-heading" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-x-3 text-eyebrow">
          <span>Brief</span>
          {risk && <Badge variant="outline">{risk} risk</Badge>}
          <span className="normal-case tracking-normal text-muted-foreground">
            by {review.pr.author}
          </span>
        </p>
        <h2 id="brief-heading" className="text-title text-balance">
          <InlineMarkdown text={review.pr.title} />
        </h2>
      </header>
      <ModelSummary
        review={review}
        orientation={props.orientation}
        onRetry={props.onRetryOrientation}
      />
      <Facts review={review} />
      {review.pr.bodyHtml.trim() && <PrDescription html={review.pr.bodyHtml} />}
      <LinkedIssues issues={workspace.linkedIssues.issues} />
      <OrderSuggestion {...props} />
      <LookOutFor hotspots={workspace.hotspots} workspace={workspace} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-pretty text-sm text-muted-foreground">
          {session.stepOrder === null
            ? "Steps are in the built-in order and ready now."
            : "Steps are in the order you chose."}
        </p>
        {first && (
          <Button onClick={() => workspace.selectStep(first.id)}>
            Start with step 1 <ArrowRight />
          </Button>
        )}
      </div>
    </article>
  );
}
