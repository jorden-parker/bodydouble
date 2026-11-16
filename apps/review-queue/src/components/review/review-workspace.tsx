"use client";

import { type ReactNode, type RefObject, useEffect, useMemo, useRef } from "react";
import { cn } from "cn";
import type { PreparedFile, ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { PullRequestRef, Step } from "@/lib/types";
import { CentreBody } from "./centre";
import { Companion } from "./companion";
import { CommandPalette, usePaletteHotkey } from "./command-palette";
import { JumpTrail } from "./jump-trail";
import { NoticeSlot, noticesOf } from "./notice-slot";
import { noteAnchorOf } from "./note-range";
import { occurrencesOf } from "./occurrences";
import { PanelResizeHandle } from "./panel-resize-handle";
import { PathRail } from "./path-rail";
import { PauseDialog } from "./pause-dialog";
import { PostedToast } from "./posted-toast";
import { ResumeCard } from "./resume-card";
import { SelectionToolbar } from "./selection-toolbar";
import { ShortcutHelp } from "./shortcut-help";
import { WorkspaceTopBar } from "./workspace-top-bar";
import { orderedSteps } from "./step-order";
import { StartOverDialog } from "./start-over-dialog";
import type { StepViewContext } from "./step-view";
import { usePanelSizings, usePanelWidth } from "./use-panel-width";
import type { OrientationState, useReview } from "./use-review";
import { useReferenceCounts } from "./use-file-symbols";
import { useWorkspace, type Workspace } from "./use-workspace";
import type { PanelSide } from "./panel-width";

type WorkspaceProps = {
  pullRequest: PullRequestRef;
  review: ReviewPayload;
  session: Session;
  orientation: OrientationState;
  controls: ReturnType<typeof useReview>;
};

type Sizing = ReturnType<typeof usePanelWidth>;

function navigablePaths(steps: Step[], files: ReadonlyMap<string, PreparedFile>): string[] {
  const paths = steps.flatMap((step) => step.files.map((stepFile) => stepFile.path));
  return [...new Set(paths)].filter((path) => files.get(path)?.navigable);
}

function useRegionFocus(
  isOpen: boolean,
  regionRef: RefObject<HTMLElement | null>,
  fallbackRef: RefObject<HTMLElement | null>,
) {
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    if (isOpen) {
      regionRef.current?.focus({ preventScroll: true });
      return;
    }
    const hasLostFocus = !document.activeElement || document.activeElement === document.body;
    if (hasLostFocus) fallbackRef.current?.focus({ preventScroll: true });
  }, [isOpen, regionRef, fallbackRef]);
}

function RegionFrame({
  side,
  open,
  sizing,
  regionRef,
  label,
  children,
}: {
  side: PanelSide;
  open: boolean;
  sizing: Sizing;
  regionRef: RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
}) {
  const isLeft = side === "left";
  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      role={isLeft ? undefined : "complementary"}
      aria-label={isLeft ? undefined : label}
      style={{ width: sizing.width }}
      className={cn(
        "relative min-h-0 min-w-0 flex-col bg-surface p-3 focus-visible:outline-none max-lg:absolute max-lg:inset-y-0 max-lg:z-30 max-lg:max-w-panel-overlay",
        open ? "flex" : "hidden",
        isLeft
          ? "col-start-1 row-start-1 border-r border-line-soft max-lg:left-0"
          : "col-start-3 row-start-1 border-l border-line-soft max-lg:right-0",
      )}
    >
      <PanelResizeHandle sizing={sizing} side={side} />
      {children}
    </div>
  );
}

function WorkspaceSelectionToolbar({ workspace }: { workspace: Workspace }) {
  const { selection } = workspace;
  if (!selection) return null;
  const anchor = noteAnchorOf(
    workspace.files.get(selection.range.path)?.hunks ?? [],
    selection.range,
  );
  return (
    <SelectionToolbar
      selection={selection}
      aiEnabled={workspace.aiEnabled}
      onNote={
        anchor
          ? () =>
              workspace.setComposer({
                path: anchor.path,
                side: anchor.side,
                startLine: anchor.startLine,
                line: anchor.line,
                endLine: anchor.line,
              })
          : null
      }
      onAction={(action) => workspace.startAsk({ kind: "lines", range: selection.range }, action)}
      onAsk={(question) => workspace.askAbout({ kind: "lines", range: selection.range }, question)}
    />
  );
}

function Dialogs({
  review,
  session,
  workspace,
}: {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
}) {
  const close = () => workspace.setDialog(null);
  switch (workspace.dialog) {
    case "resume":
      return (
        <ResumeCard
          session={session}
          steps={review.steps}
          nextStep={workspace.nextStep}
          reopenedCount={review.reopenedStepIds.length}
          pullRequest={review.pr.ref}
          headSha={review.headSha}
          onContinue={workspace.resume}
          onShowChanges={workspace.showChangesFromResume}
        />
      );
    case "pause":
      return <PauseDialog onPause={workspace.pause} onCancel={close} />;
    case "help":
      return <ShortcutHelp onClose={close} />;
    case "start-over":
      return (
        <StartOverDialog
          noteCount={session.notes.length}
          onStartOver={workspace.startOver}
          onCancel={close}
        />
      );
    default:
      return null;
  }
}

function useStepContext(
  session: Session,
  workspace: Workspace,
  referenceCounts: ReturnType<typeof useReferenceCounts>,
): StepViewContext {
  const { setComposer, showContextView } = workspace;
  const openAssist = workspace.startAsk;
  const handlers: StepViewContext["handlers"] = useMemo(
    () => ({
      onIdentifier: workspace.peekName,
      onHoverIdentifier: workspace.setHovered,
      onAddNote: (target) => setComposer(target),
      onDeleteNote: workspace.deleteNote,
      onToggleHotspot: workspace.toggleHotspot,
      onCheckFlag: workspace.aiEnabled
        ? (range) => openAssist({ kind: "lines", range }, "check")
        : null,
      onSaveNote: workspace.saveNote,
      onCancelNote: () => setComposer(null),
      onShowReferences: workspace.peek.showReferences,
      onOpenConversation: () => showContextView("github"),
    }),
    [
      workspace.peekName,
      workspace.setHovered,
      setComposer,
      workspace.deleteNote,
      workspace.toggleHotspot,
      workspace.aiEnabled,
      workspace.saveNote,
      openAssist,
      workspace.peek.showReferences,
      showContextView,
    ],
  );
  return useMemo(
    () => ({
      files: workspace.files,
      hotspots: workspace.hotspots,
      checkedHotspots: session.checkedHotspots,
      notes: session.notes,
      threads: workspace.threads,
      composer: workspace.composer,
      landed: workspace.landed,
      occurrences: occurrencesOf(workspace.peek.peek),
      activeHunkId: workspace.activeHunkId,
      referenceCounts,
      loadFile: workspace.loadFile,
      onAskFile: workspace.aiEnabled ? workspace.askFile : null,
      handlers,
    }),
    [
      workspace.files,
      workspace.hotspots,
      workspace.threads,
      workspace.composer,
      workspace.landed,
      workspace.activeHunkId,
      workspace.aiEnabled,
      workspace.peek.peek,
      workspace.askFile,
      workspace.loadFile,
      session.notes,
      session.checkedHotspots,
      referenceCounts,
      handlers,
    ],
  );
}

export function ReviewWorkspace({
  pullRequest,
  review: payload,
  session,
  orientation,
  controls,
}: WorkspaceProps) {
  const review = useMemo(() => {
    const steps = orderedSteps(payload.steps, session.stepOrder);
    return { ...payload, steps, startStepId: steps[0]?.id ?? null };
  }, [payload, session.stepOrder]);
  const workspace = useWorkspace(pullRequest, review, session, orientation, controls);
  const sizings = usePanelSizings(workspace.regionOpen);
  const referenceCounts = useReferenceCounts(
    pullRequest,
    review.headSha,
    navigablePaths(workspace.visibleSteps, workspace.files),
  );
  const context = useStepContext(session, workspace, referenceCounts);
  const railRef = useRef<HTMLDivElement>(null);
  const companionRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useRegionFocus(workspace.regionOpen.left, railRef, mainRef);
  useRegionFocus(workspace.regionOpen.right, companionRef, mainRef);
  usePaletteHotkey(workspace.openPalette);
  const notices = noticesOf({
    actionError: controls.actionError,
    workspace,
    state: review.pr.state,
  });

  return (
    <div className="grid min-h-0 flex-1 grid-rows-shell">
      <WorkspaceTopBar review={review} session={session} workspace={workspace} />
      <div className="relative grid min-h-0 grid-cols-workspace">
        <RegionFrame
          side="left"
          open={workspace.regionOpen.left}
          sizing={sizings.left}
          regionRef={railRef}
          label="Review path"
        >
          <PathRail review={review} session={session} workspace={workspace} />
        </RegionFrame>
        <div className="relative col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col bg-canvas-deep">
          <main
            id="main"
            ref={mainRef}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-24 focus-visible:outline-none sm:px-8"
          >
            <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6">
              <NoticeSlot notices={notices} />
              <CentreBody
                payload={payload}
                review={review}
                session={session}
                workspace={workspace}
                orientation={orientation}
                context={context}
                loadFile={workspace.loadFile}
                onRetryOrientation={controls.retryOrientation}
              />
            </div>
          </main>
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4">
            <JumpTrail
              jumps={session.jumps}
              onBack={workspace.back}
              onClear={workspace.clearJumps}
            />
          </div>
        </div>
        <RegionFrame
          side="right"
          open={workspace.regionOpen.right}
          sizing={sizings.right}
          regionRef={companionRef}
          label="Companion"
        >
          <Companion review={review} session={session} workspace={workspace} />
        </RegionFrame>
      </div>
      <WorkspaceSelectionToolbar workspace={workspace} />
      <Dialogs review={review} session={session} workspace={workspace} />
      {workspace.isPaletteOpen && <CommandPalette review={review} workspace={workspace} />}
      {workspace.posted && (
        <PostedToast
          url={session.submissions[0]?.url ?? null}
          onDismiss={() => workspace.setPosted(false)}
        />
      )}
    </div>
  );
}
