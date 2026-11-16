"use client";

import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { BriefPage } from "./brief-page";
import { ChangesView } from "./changes-view";
import { FileView } from "./file-view";
import { stepsDone } from "./progress";
import { StepBar } from "./step-bar";
import { StepHeader } from "./step-header";
import { StepView, type StepViewContext } from "./step-view";
import type { LoadFile } from "./use-file-lines";
import type { OrientationState } from "./use-review";
import type { Workspace } from "./use-workspace";
import { WrapUpPage } from "./wrap-up-page";

type CentreProps = {
  payload: ReviewPayload;
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
  orientation: OrientationState;
  context: StepViewContext;
  loadFile: LoadFile;
  onRetryOrientation: () => void;
};

function StepPage({ review, session, workspace, orientation, context }: CentreProps) {
  if (workspace.showAll) {
    return (
      <div className="flex flex-col gap-8">
        <Button variant="ghost" className="self-start" onClick={() => workspace.setShowAll(false)}>
          <ArrowLeft /> One step at a time
        </Button>
        {review.steps.map((step) => (
          <div key={step.id} className="flex flex-col gap-3">
            <h2 className="text-heading text-balance">{step.title}</h2>
            <StepView step={step} context={context} />
          </div>
        ))}
      </div>
    );
  }
  const step = workspace.currentStep;
  if (!step) return <EmptyState>This PR has no file changes.</EmptyState>;
  return (
    <div key={step.id} className="flex animate-step-enter flex-col gap-6">
      <StepHeader
        review={review}
        session={session}
        workspace={workspace}
        orientation={orientation}
      />
      <StepView step={step} context={context} />
      <StepBar review={review} session={session} workspace={workspace} />
    </div>
  );
}

function WrapPage({ review, session, workspace }: CentreProps) {
  const stepsLeft = review.steps.length - stepsDone(review, session.doneSteps);
  const hotspotsLeft = workspace.hotspots.filter(
    (hotspot) => !session.checkedHotspots.includes(hotspot.id),
  ).length;
  const lastStep = review.steps[review.steps.length - 1];
  const nextIndex = workspace.nextStep
    ? review.steps.findIndex((step) => step.id === workspace.nextStep?.id)
    : -1;
  return (
    <WrapUpPage
      notes={session.notes}
      stepsLeft={stepsLeft}
      stepsTotal={review.steps.length}
      hotspotsLeft={hotspotsLeft}
      headSha={review.headSha}
      files={review.files}
      backLabel={lastStep ? `Back to step ${review.steps.length}` : "Back to the brief"}
      openWorkLabel={nextIndex >= 0 ? `Go to step ${nextIndex + 1}` : "Go to the open hotspot"}
      onSubmit={workspace.submit}
      onDraftSummary={workspace.aiEnabled ? workspace.draftSummary : undefined}
      onBack={() => (lastStep ? workspace.selectStep(lastStep.id) : workspace.goToBrief())}
      onGoToOpenWork={workspace.goToOpenWork}
    />
  );
}

function BriefView({
  review,
  session,
  payload,
  workspace,
  orientation,
  onRetryOrientation,
}: CentreProps) {
  return (
    <BriefPage
      review={review}
      session={session}
      builtInStepIds={payload.steps.map((step) => step.id)}
      orientation={orientation}
      workspace={workspace}
      onRetryOrientation={onRetryOrientation}
    />
  );
}

export function CentreBody(props: CentreProps) {
  const { workspace, review, context, loadFile } = props;
  if (workspace.openFile) {
    return (
      <FileView
        key={workspace.openFile.path}
        target={workspace.openFile}
        loadFile={loadFile}
        onIdentifier={workspace.peekName}
        onClose={workspace.closeFile}
      />
    );
  }
  if (workspace.showChanges) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => workspace.setShowChanges(false)}
        >
          <ArrowLeft /> Back to the path
        </Button>
        <ChangesView
          pullRequest={workspace.pullRequest}
          headSha={review.headSha}
          context={context}
          onCaughtUp={workspace.catchUp}
        />
      </div>
    );
  }
  if (workspace.page === "brief") return <BriefView {...props} />;
  if (workspace.page === "wrap") return <WrapPage {...props} />;
  return <StepPage {...props} />;
}
