"use client";

import { Check } from "lucide-react";
import { plural } from "@/lib/plural";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { stepReasons } from "./step-order";
import { StepExplanation } from "./step-explanation";
import type { OrientationState } from "./use-review";
import type { Workspace } from "./use-workspace";

type StepHeaderProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
  orientation: OrientationState;
};

export function StepHeader({ review, session, workspace, orientation }: StepHeaderProps) {
  const step = workspace.currentStep;
  if (!step) return null;
  const modelReason = stepReasons(orientation)[step.id];
  const done = session.doneSteps.includes(step.id);
  return (
    <section
      aria-labelledby="step-heading"
      className="flex flex-col gap-3 rounded-xl border border-line-soft bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="whitespace-nowrap text-eyebrow tabular-nums">
          Step&nbsp;{workspace.currentIndex + 1}&nbsp;of&nbsp;{review.steps.length}
        </p>
        <Badge variant="outline">
          {step.role}, {plural(step.changedLines, "line")}
        </Badge>
        {done && (
          <Badge className="bg-add text-add-foreground">
            <Check /> Done
          </Badge>
        )}
        <HintButton
          variant="ghost"
          size="sm"
          className="ml-auto"
          hint={workspace.showAll ? "Back to one step at a time" : "Show whole PR"}
          shortcut="a"
          onClick={() => workspace.setShowAll(!workspace.showAll)}
        >
          {workspace.showAll ? "One step at a time" : "Show whole PR"}
        </HintButton>
      </div>
      <h2 id="step-heading" className="text-heading text-balance">
        {step.title}
      </h2>
      <p className="text-pretty text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Why now:</span>{" "}
        {modelReason ? (
          <>
            <InlineMarkdown text={modelReason} /> <span>Model&apos;s guess.</span>
          </>
        ) : (
          step.reason
        )}
      </p>
      {workspace.aiEnabled && (
        <StepExplanation
          key={step.id}
          pullRequest={review.pr.ref}
          headSha={review.headSha}
          stepId={step.id}
          onAskMore={(check, text) =>
            workspace.startAsk(
              { kind: "check", stepId: step.id, check, path: step.files[0].path },
              "explain",
              `Tell me more: ${text}`,
            )
          }
        />
      )}
    </section>
  );
}
