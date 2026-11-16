"use client";

import { Coffee } from "lucide-react";
import { useCallback } from "react";
import { AppDialog } from "@/components/common/app-dialog";
import { Callout } from "@/components/common/callout";
import { InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import type { ChangesSummaryResult } from "@/lib/review/changes-summary-service";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef, Step } from "@/lib/types";
import { fetchChangesSummary } from "./api";
import { ModelUnavailable, useModelResult } from "./model-result";

type ResumeCardProps = {
  session: Session;
  steps: Step[];
  nextStep: Step | null;
  reopenedCount: number;
  pullRequest: PullRequestRef;
  headSha: string;
  onContinue: () => void;
  onShowChanges: () => void;
};

function sinceText(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

function useChangesSummary(pullRequest: PullRequestRef, headSha: string) {
  const load = useCallback(() => fetchChangesSummary(pullRequest, headSha), [pullRequest, headSha]);
  return useModelResult<ChangesSummaryResult>(load);
}

function ChangesSummary({
  pullRequest,
  headSha,
}: {
  pullRequest: PullRequestRef;
  headSha: string;
}) {
  const { state, retry } = useChangesSummary(pullRequest, headSha);
  if (state.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Local model is reading what changed…
      </p>
    );
  }
  if (state.status === "error") return <ModelUnavailable message={state.message} onRetry={retry} />;
  if (state.status !== "ready") return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3 text-sm text-foreground">
      <p className="text-sm text-muted-foreground">
        The model&apos;s guess, unverified. The PR author can sway it.
      </p>
      <Markdown text={state.summary.summary} className="flex flex-col gap-1.5" />
    </div>
  );
}

type NewCommitsProps = {
  reopenedCount: number;
  canShowChanges: boolean;
  pullRequest: PullRequestRef;
  headSha: string;
  onShowChanges: () => void;
};

function NewCommits({
  reopenedCount,
  canShowChanges,
  pullRequest,
  headSha,
  onShowChanges,
}: NewCommitsProps) {
  if (reopenedCount === 0 && !canShowChanges) return null;
  return (
    <div className="flex flex-col items-start gap-2 text-severity-medium">
      {reopenedCount > 0 && (
        <span>
          New commits changed {reopenedCount} step{reopenedCount === 1 ? "" : "s"} you had finished.
          They are marked again.
        </span>
      )}
      {canShowChanges && <ChangesSummary pullRequest={pullRequest} headSha={headSha} />}
      {canShowChanges && (
        <Button variant="outline" size="sm" onClick={onShowChanges}>
          Show what changed
        </Button>
      )}
    </div>
  );
}

export function ResumeCard({
  session,
  steps,
  nextStep,
  reopenedCount,
  pullRequest,
  headSha,
  onContinue,
  onShowChanges,
}: ResumeCardProps) {
  const current = steps.find((step) => step.id === session.currentStepId);
  const position = current ? steps.indexOf(current) + 1 : null;
  const lastNote = session.notes.at(-1);
  const pinned = session.contextSymbols.filter((symbol) => symbol.pinned);
  return (
    <AppDialog
      title={
        <span className="flex items-center gap-2">
          <Coffee className="size-5 animate-float text-primary" /> Welcome back
        </span>
      }
      onClose={onContinue}
    >
      <dl className="flex flex-col gap-3 text-sm">
        {session.pause && (
          <Callout tone="muted">
            <dt className="text-sm font-medium">You said you were about to</dt>
            <dd className="text-base">
              <InlineMarkdown text={session.pause.note || "(no note)"} />
            </dd>
            <dd className="text-sm opacity-75">paused {sinceText(session.pause.at)}</dd>
          </Callout>
        )}
        {current && (
          <div>
            <dt className="text-muted-foreground">You were on</dt>
            <dd className="font-medium">
              Step {position} of {steps.length}: {current.title}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted-foreground">Progress</dt>
          <dd>
            {session.doneSteps.length} of {steps.length} steps done,{" "}
            {plural(session.notes.length, "note")}
          </dd>
        </div>
        {lastNote && (
          <div>
            <dt className="text-muted-foreground">Your last note</dt>
            <dd className="italic">
              <InlineMarkdown text={lastNote.body} />
            </dd>
          </div>
        )}
        {session.jumps.length > 0 && (
          <div>
            <dt className="text-muted-foreground">You were following</dt>
            <dd className="font-mono">{session.jumps.map((jump) => jump.name).join(" → ")}</dd>
          </div>
        )}
        {pinned.length > 0 && (
          <div>
            <dt className="text-muted-foreground">You pinned</dt>
            <dd className="font-mono">{pinned.map((symbol) => symbol.name).join(", ")}</dd>
          </div>
        )}
        <NewCommits
          reopenedCount={reopenedCount}
          canShowChanges={session.baselineHeadSha !== null}
          pullRequest={pullRequest}
          headSha={headSha}
          onShowChanges={onShowChanges}
        />
      </dl>
      <Button size="lg" onClick={onContinue} autoFocus>
        {nextStep ? `Continue with: ${nextStep.title}` : "Continue"}
      </Button>
    </AppDialog>
  );
}
