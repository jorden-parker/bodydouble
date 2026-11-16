"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_LOOKUP_BUDGET } from "@/lib/assist-protocol";
import type { NoteTag } from "@/lib/types";
import type { RunOptions } from "./assist-thread";
import { CommentDraft } from "./comment-draft";

const FOLLOW_UP_QUESTIONS = ["Who calls this?", "Is it tested?", "What could break?"];

const NOTE_TAG: NoteTag = { kind: "question", decorations: [] };

type AnswerActionsProps = {
  text: string;
  commentLine: number | null;
  hasBudgetEnded: boolean;
  onSaveNote: (line: number | null, tag: NoteTag, body: string) => void;
  onFollowUp: (question: string) => void;
  onRerun: (options: RunOptions) => void;
  onAskClaude: () => void;
};

export function AnswerActions({
  text,
  commentLine,
  hasBudgetEnded,
  onSaveNote,
  onFollowUp,
  onRerun,
  onAskClaude,
}: AnswerActionsProps) {
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={isDrafting}
          onClick={() => setIsDrafting(!isDrafting)}
        >
          Turn into a comment
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isSaved}
          onClick={() => {
            onSaveNote(commentLine, NOTE_TAG, text.trim());
            setIsSaved(true);
          }}
        >
          {isSaved ? "Saved as note" : "Save as note"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => onRerun({ hasMoreDetail: true })}>
          More detail
        </Button>
        {hasBudgetEnded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRerun({ lookupBudget: MAX_LOOKUP_BUDGET })}
          >
            Keep looking
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onAskClaude}>
          Ask Claude instead
        </Button>
      </div>
      {isDrafting && (
        <CommentDraft
          key={text}
          draft={text}
          commentLine={commentLine}
          onSave={(tag, body) => onSaveNote(commentLine, tag, body)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Try:</span>
        {FOLLOW_UP_QUESTIONS.map((question) => (
          <Button key={question} variant="ghost" size="sm" onClick={() => onFollowUp(question)}>
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
