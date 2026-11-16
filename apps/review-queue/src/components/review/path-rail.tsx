"use client";

import { Check, Circle, Flag, Play, Send, StickyNote } from "lucide-react";
import { cn } from "cn";
import { PathLabel } from "@/components/common/path-label";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Session } from "@/lib/session/store";
import type { Note, Step } from "@/lib/types";
import { hotspotsInStep } from "./display-hotspots";
import { HotspotList } from "./hotspot-list";
import type { Workspace } from "./use-workspace";

type PathRailProps = {
  review: ReviewPayload;
  session: Session;
  workspace: Workspace;
};

function notesInStep(notes: Note[], step: Step): Note[] {
  const paths = new Set(step.files.map((file) => file.path));
  return notes.filter((note) => note.path !== null && paths.has(note.path));
}

function entryClasses(isCurrent: boolean): string {
  return cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-calm hover:bg-muted",
    isCurrent && "bg-muted font-semibold",
  );
}

function countLabel(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function StepCounts({ hotspots, notes }: { hotspots: number; notes: number }) {
  if (hotspots === 0 && notes === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
      {hotspots > 0 && (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <Flag aria-hidden className="size-3" />
          <span className="sr-only">{countLabel(hotspots, "hotspot")}</span>
          <span aria-hidden>{hotspots}</span>
        </span>
      )}
      {notes > 0 && (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <StickyNote aria-hidden className="size-3" />
          <span className="sr-only">{countLabel(notes, "note")}</span>
          <span aria-hidden>{notes}</span>
        </span>
      )}
    </span>
  );
}

function StepFiles({ step, workspace }: { step: Step; workspace: Workspace }) {
  return (
    <ul aria-label="Files in this step" className="flex flex-col gap-0.5 pl-9">
      {step.files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() =>
              workspace.goTo({
                path: file.path,
                line: workspace.files.get(file.path)?.hunks[0]?.newStart ?? 1,
              })
            }
            className="block w-full min-w-0 truncate rounded-sm px-1 text-left hover:bg-muted"
          >
            <PathLabel path={file.path} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function StepNotes({ notes, workspace }: { notes: Note[]; workspace: Workspace }) {
  if (notes.length === 0) return null;
  return (
    <section aria-label="Notes in this step" className="flex flex-col gap-1 pl-9">
      <h3 className="text-xs font-semibold text-muted-foreground">Notes</h3>
      <ul className="flex flex-col gap-1">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => note.path && workspace.goTo({ path: note.path, line: note.line ?? 1 })}
              className="line-clamp-2 w-full text-left text-sm text-muted-foreground hover:text-foreground"
            >
              {note.body}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExpandedStep({
  step,
  session,
  workspace,
}: {
  step: Step;
  session: Session;
  workspace: Workspace;
}) {
  const hotspots = hotspotsInStep(workspace.hotspots, step);
  const notes = notesInStep(session.notes, step);
  return (
    <div className="flex flex-col gap-3 pb-2">
      <StepFiles step={step} workspace={workspace} />
      <section
        id="path-hotspots"
        tabIndex={-1}
        aria-label="Hotspots in this step"
        className="flex flex-col gap-1 pl-9 focus-visible:outline-none"
      >
        <h3 className="text-xs font-semibold text-muted-foreground">Hotspots</h3>
        {hotspots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing unusual spotted here.</p>
        ) : (
          <HotspotList
            hotspots={hotspots}
            checked={session.checkedHotspots}
            onOpen={(hotspot) => workspace.goTo({ path: hotspot.path, line: hotspot.line ?? 1 })}
            onToggleChecked={workspace.toggleHotspot}
          />
        )}
      </section>
      <StepNotes notes={notes} workspace={workspace} />
    </div>
  );
}

function StepEntry({
  step,
  index,
  session,
  workspace,
}: {
  step: Step;
  index: number;
  session: Session;
  workspace: Workspace;
}) {
  const done = session.doneSteps.includes(step.id);
  const isCurrent = workspace.page === "step" && workspace.currentStep?.id === step.id;
  const hotspotCount = hotspotsInStep(workspace.hotspots, step).length;
  const noteCount = notesInStep(session.notes, step).length;
  const label = done ? "Mark as not done" : "Mark as done";
  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${label}: ${step.title}`}
          onClick={() => workspace.setStepDone(step.id, !done)}
        >
          {done ? <Check className="text-primary" /> : <Circle className="text-muted-foreground" />}
        </Button>
        <button
          type="button"
          aria-current={isCurrent ? "step" : undefined}
          onClick={() => workspace.selectStep(step.id)}
          className={entryClasses(isCurrent)}
        >
          <span
            className={cn("min-w-0 flex-1 truncate", done && "text-muted-foreground line-through")}
          >
            {index + 1}. {step.title}
          </span>
          <StepCounts hotspots={hotspotCount} notes={noteCount} />
        </button>
      </div>
      {isCurrent && <ExpandedStep step={step} session={session} workspace={workspace} />}
    </li>
  );
}

function BriefEntry({ workspace }: { workspace: Workspace }) {
  const isCurrent = workspace.page === "brief";
  return (
    <li>
      <button
        type="button"
        aria-current={isCurrent ? "page" : undefined}
        onClick={workspace.goToBrief}
        className={cn(entryClasses(isCurrent), "ml-8")}
      >
        {isCurrent ? <Play className="size-3.5 text-primary" aria-hidden /> : null}
        Brief
      </button>
    </li>
  );
}

function WrapEntry({ workspace }: { workspace: Workspace }) {
  const isCurrent = workspace.page === "wrap";
  return (
    <li>
      <button
        type="button"
        aria-current={isCurrent ? "page" : undefined}
        onClick={workspace.goToWrap}
        className={cn(entryClasses(isCurrent), "ml-8")}
      >
        {isCurrent ? <Play className="size-3.5 text-primary" aria-hidden /> : null}
        <Send aria-hidden className="size-3.5" />
        Wrap up
      </button>
    </li>
  );
}

export function PathRail({ review, session, workspace }: PathRailProps) {
  return (
    <nav aria-label="Review path" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <p className="px-2 text-eyebrow">Path</p>
      <ol className="flex flex-col gap-0.5">
        <BriefEntry workspace={workspace} />
        {review.steps.map((step, index) => (
          <StepEntry
            key={step.id}
            step={step}
            index={index}
            session={session}
            workspace={workspace}
          />
        ))}
        <WrapEntry workspace={workspace} />
      </ol>
      <p className="mt-auto px-2 text-xs text-muted-foreground text-pretty">
        <Kbd>⌘K</Kbd> Files, outline, map, GitHub
      </p>
    </nav>
  );
}
