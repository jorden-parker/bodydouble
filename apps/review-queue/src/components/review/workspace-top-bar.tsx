"use client";

import {
  ArrowLeft,
  Coffee,
  CircleHelp,
  Ellipsis,
  ExternalLink,
  Keyboard,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { prKey } from "@/lib/pr-ref";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import { FocusTimer } from "./focus-timer";
import { LinkedIssueChip } from "./linked-issue-chip";
import { minutesLeft, stepsDone } from "./progress";
import type { Workspace } from "./use-workspace";

type WorkspaceTopBarProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
};

function progressLabel(review: ReviewPayload, session: Session, workspace: Workspace): string {
  const total = review.steps.length;
  if (workspace.page === "wrap") return "Wrap up";
  const minutes = minutesLeft(review, session.doneSteps);
  const done = stepsDone(review, session.doneSteps);
  const estimate = minutes > 0 ? ` · ~${minutes} min left` : "";
  return `${done} of ${total}${estimate}`;
}

function ProgressIndicator({ review, session, workspace }: WorkspaceTopBarProps) {
  const total = review.steps.length;
  const percent = total ? Math.round((stepsDone(review, session.doneSteps) / total) * 100) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm tabular-nums">
      <Progress
        aria-label="Steps read"
        value={percent}
        className="hidden w-20 shrink-0 sm:block"
        indicatorClassName="bg-whimsy"
      />
      <span className="whitespace-nowrap text-muted-foreground">
        {progressLabel(review, session, workspace)}
      </span>
    </div>
  );
}

function TopBarMenu({ workspace }: Pick<WorkspaceTopBarProps, "workspace">) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More actions">
          <Ellipsis />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-0.5 p-1">
        <div className="px-1 py-1">
          <LinkedIssueChip issues={workspace.linkedIssues.issues} />
        </div>
        <div className="px-1 py-1">
          <FocusTimer onFinished={() => workspace.setBreakDue(true)} />
        </div>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => workspace.toggleSide("left")}
        >
          <PanelLeft /> {workspace.regionOpen.left ? "Hide the path" : "Show the path"}
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => workspace.toggleSide("right")}
        >
          <PanelRight /> {workspace.regionOpen.right ? "Hide the companion" : "Show the companion"}
        </Button>
        <Button variant="ghost" className="justify-start" onClick={workspace.goToWrap}>
          <Send /> Wrap up
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => workspace.setDialog("start-over")}
        >
          <RotateCcw /> Start over
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => workspace.setDialog("help")}
        >
          <CircleHelp /> Keyboard shortcuts <Kbd className="ml-auto">?</Kbd>
        </Button>
        <Button variant="ghost" className="justify-start" onClick={workspace.openPalette}>
          <Keyboard /> Command palette <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function WorkspaceTopBar({ review, session, workspace }: WorkspaceTopBarProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft bg-background px-3 py-2 sm:px-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/" aria-label="Back to queue">
          <ArrowLeft /> <span className="hidden sm:inline">Queue</span>
        </Link>
      </Button>
      <p className="hidden whitespace-nowrap font-mono text-sm text-muted-foreground sm:block">
        {prKey(review.pr.ref)}
      </p>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
        <InlineMarkdown text={review.pr.title} />
      </h1>
      <ProgressIndicator review={review} session={session} workspace={workspace} />
      <HintButton
        variant="ghost"
        size="sm"
        hint="Pause with a note"
        shortcut="."
        onClick={() => workspace.setDialog("pause")}
      >
        <Coffee />
        <span className="hidden sm:inline">Pause</span>
        <span className="sr-only sm:hidden">Pause</span>
      </HintButton>
      <HintButton
        variant="ghost"
        size="sm"
        hint="Open on GitHub"
        aria-label={`Open ${prKey(review.pr.ref)} on GitHub`}
        asChild
      >
        <a href={review.pr.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </HintButton>
      <TopBarMenu workspace={workspace} />
    </header>
  );
}
