"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { HintButton } from "@/components/common/hint-button";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { hotspotsInStep } from "./display-hotspots";
import type { Workspace } from "./use-workspace";

type StepBarProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
};

function leftText(review: ReviewPayload, session: Session, workspace: Workspace): string {
  const step = workspace.currentStep;
  if (!step) return "";
  const open = hotspotsInStep(workspace.hotspots, step).filter(
    (hotspot) => !session.checkedHotspots.includes(hotspot.id),
  ).length;
  return open > 0 ? `${plural(open, "hotspot")} left to check` : "Nothing left to check here";
}

export function StepBar({ review, session, workspace }: StepBarProps) {
  const step = workspace.currentStep;
  if (!step) return null;
  const isLast = workspace.currentIndex >= review.steps.length - 1;
  const finishStep = () => {
    workspace.setStepDone(step.id, true);
    workspace.goToWrap();
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
      <HintButton
        variant="ghost"
        hint="Previous step"
        shortcut="p"
        onClick={() => workspace.moveStep(-1)}
        disabled={workspace.currentIndex <= 0}
      >
        <ArrowLeft /> Previous
      </HintButton>
      <p className="text-pretty text-center text-sm text-muted-foreground">
        {leftText(review, session, workspace)}
      </p>
      {isLast ? (
        <Button onClick={finishStep}>
          Done, wrap up <ArrowRight />
        </Button>
      ) : (
        <HintButton hint="Mark done and go on" shortcut="x" onClick={workspace.doneAndNext}>
          Done, next step <ArrowRight />
        </HintButton>
      )}
    </div>
  );
}
