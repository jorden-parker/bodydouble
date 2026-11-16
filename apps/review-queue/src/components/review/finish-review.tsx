"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "cn";
import { AppDialog } from "@/components/common/app-dialog";
import { Callout } from "@/components/common/callout";
import { Markdown } from "@/components/common/markdown-text";
import { EmptyState } from "@/components/common/empty-state";
import { PathLabel } from "@/components/common/path-label";
import { Otter } from "@/components/neon/otter";
import { isBlocking } from "@/lib/review/conventional-comment";
import { notesOffTheDiff, offTheDiffMessage } from "@/lib/review/note-targets";
import { isPostable, postedBody } from "@/lib/review/submission";
import { plural } from "@/lib/plural";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MarkdownField } from "@/components/common/markdown-field";
import type { ReviewEvent } from "@/lib/github/gh";
import type { FileDiff, Note } from "@/lib/types";
import { NoteKindBadge } from "./note-kind-badge";
import { unfinishedMessage } from "./unfinished";

type DraftSummary = (event: ReviewEvent, noteIds: number[]) => Promise<string>;

type FinishReviewProps = {
  notes: Note[];
  stepsLeft: number;
  hotspotsLeft: number;
  headSha: string;
  files: FileDiff[];
  onSubmit: (event: ReviewEvent, summary: string, noteIds: number[]) => Promise<void>;
  onDraftSummary?: DraftSummary;
  onCancel: () => void;
};

const VERDICTS: { value: ReviewEvent; label: string; hint: string; tint: string }[] = [
  { value: "APPROVE", label: "Approve", hint: "Good to merge", tint: "bg-tint-mint" },
  { value: "COMMENT", label: "Comment", hint: "Feedback, no verdict", tint: "bg-tint-blue" },
  {
    value: "REQUEST_CHANGES",
    label: "Request changes",
    hint: "Blocks the merge until fixed",
    tint: "bg-tint-coral",
  },
];

function verdictLabel(event: ReviewEvent): string {
  return VERDICTS.find((verdict) => verdict.value === event)?.label ?? event;
}

function defaultEvent(notes: Note[], unfinished: string | null): ReviewEvent {
  if (notes.some(isBlocking)) return "REQUEST_CHANGES";
  if (unfinished === null && !notes.some((note) => note.kind === "question")) return "APPROVE";
  return "COMMENT";
}

type DraftSummaryButtonProps = {
  draftSummary: DraftSummary;
  event: ReviewEvent;
  noteIds: number[];
  summary: string;
  onDrafted: (summary: string) => void;
};

function DraftSummaryButton({
  draftSummary,
  event,
  noteIds,
  summary,
  onDrafted,
}: DraftSummaryButtonProps) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  async function draftFromNotes() {
    setDrafting(true);
    setDraftError(null);
    try {
      onDrafted(await draftSummary(event, noteIds));
    } catch (failure) {
      setDraftError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="soft"
        onClick={draftFromNotes}
        disabled={drafting || summary.trim() !== "" || noteIds.length === 0}
      >
        <Sparkles />
        {drafting ? "Drafting…" : "Draft from my notes"}
      </Button>
      {draftError && (
        <p role="alert" className="text-sm text-ink-coral">
          {draftError}
        </p>
      )}
    </div>
  );
}

type NoteChecklistProps = {
  notes: Note[];
  selected: number[];
  flagged: ReadonlySet<number>;
  onToggle: (id: number) => void;
};

function NoteChecklist({ notes, selected, flagged, onToggle }: NoteChecklistProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-fg">Notes to Post ({selected.length})</h3>
      {notes.length === 0 && <EmptyState emoji="📝">No notes.</EmptyState>}
      {notes.map((note) => (
        <label
          key={note.id}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line-soft bg-surface-2 p-3 text-sm text-fg transition-colors duration-calm hover:bg-surface-3"
        >
          <Checkbox
            checked={selected.includes(note.id)}
            onCheckedChange={() => onToggle(note.id)}
            className="mt-0.5"
          />
          <NoteKindBadge tag={note} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Markdown
              text={isPostable(note) ? postedBody(note) : note.body}
              className="flex flex-col gap-1.5 wrap-anywhere"
            />
            {note.path && (
              <PathLabel path={note.path} line={note.line} startLine={note.startLine} />
            )}
            {flagged.has(note.id) && (
              <span className="text-sm text-ink-coral">Line no longer in the diff</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

function initialSelection(postable: Note[], flagged: ReadonlySet<number>): number[] {
  return postable.filter((note) => !flagged.has(note.id)).map((note) => note.id);
}

type VerdictCardsProps = {
  event: ReviewEvent;
  onChoose: (event: ReviewEvent) => void;
};

function VerdictCards({ event, onChoose }: VerdictCardsProps) {
  return (
    <div role="radiogroup" aria-label="Verdict" className="grid gap-3 sm:grid-cols-3">
      {VERDICTS.map((verdict) => {
        const isChosen = event === verdict.value;
        return (
          <button
            key={verdict.value}
            type="button"
            role="radio"
            aria-label={verdict.label}
            aria-checked={isChosen}
            onClick={() => onChoose(verdict.value)}
            className={cn(
              "flex min-h-24 flex-col items-start gap-1 rounded-xl border-2 p-4 text-left text-fg transition-[border-color,box-shadow] duration-calm focus-visible:ring-3 focus-visible:ring-neon-blue focus-visible:outline-none",
              verdict.tint,
              isChosen ? "border-fg shadow-lift" : "border-transparent",
            )}
          >
            <span className="font-display text-lg font-semibold">{verdict.label}</span>
            <span className="text-sm text-fg-muted">{verdict.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FinishReview({
  notes,
  stepsLeft,
  hotspotsLeft,
  headSha,
  files,
  onSubmit,
  onDraftSummary,
  onCancel,
}: FinishReviewProps) {
  const postable = notes.filter((note) => note.kind !== "parked");
  const parkedCount = notes.length - postable.length;
  const unfinished = unfinishedMessage(stepsLeft, hotspotsLeft);
  const offDiff = notesOffTheDiff(postable, files);
  const offDiffIds = new Set(offDiff.map((note) => note.id));
  const [event, setEvent] = useState<ReviewEvent>(defaultEvent(postable, unfinished));
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState(initialSelection(postable, offDiffIds));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await onSubmit(event, summary, selected);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setSending(false);
    }
  }

  return (
    <AppDialog title="Submit Review" onClose={onCancel} wide>
      {unfinished ? (
        <Callout>{unfinished}</Callout>
      ) : (
        <p className="rounded-lg bg-tint-mint px-3 py-2 text-sm text-fg">
          Every step and hotspot is ticked off.
        </p>
      )}
      {offDiff.length > 0 && <Callout>{offTheDiffMessage(offDiff)}</Callout>}
      <section aria-labelledby="verdict-heading" className="flex flex-col gap-3">
        <h3 id="verdict-heading" className="text-sm font-bold text-fg">
          Your Verdict
        </h3>
        <VerdictCards event={event} onChoose={setEvent} />
      </section>
      <NoteChecklist notes={postable} selected={selected} flagged={offDiffIds} onToggle={toggle} />
      {parkedCount > 0 && (
        <p className="text-sm text-fg-muted">
          {plural(parkedCount, "parked note")} won’t be posted.
        </p>
      )}
      <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
        <h3 id="summary-heading" className="text-sm font-bold text-fg">
          Summary
        </h3>
        {onDraftSummary && (
          <DraftSummaryButton
            draftSummary={onDraftSummary}
            event={event}
            noteIds={selected}
            summary={summary}
            onDrafted={setSummary}
          />
        )}
        <MarkdownField
          aria-labelledby="summary-heading"
          value={summary}
          onChange={(changeEvent) => setSummary(changeEvent.target.value)}
          rows={3}
          placeholder="Overall summary (optional)"
        />
      </section>
      <section
        aria-labelledby="posted-heading"
        className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 p-4 text-sm text-fg-muted"
      >
        <h3 id="posted-heading" className="text-sm font-bold text-fg">
          What Gets Posted
        </h3>
        <p>
          {plural(selected.length, "note")} with the verdict {verdictLabel(event)}.
        </p>
        <p>Against {headSha.slice(0, 7)}</p>
      </section>
      {error && (
        <p role="alert" className="text-sm text-ink-coral">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} className="min-h-11">
          Not yet
        </Button>
        <Button variant="neon" onClick={send} disabled={sending} className="min-h-11 px-6">
          <Otter size="small" />
          {sending ? "Posting…" : "Post review"}
        </Button>
      </div>
    </AppDialog>
  );
}
