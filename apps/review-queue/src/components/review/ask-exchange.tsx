"use client";

import { X } from "lucide-react";
import { InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import { ModelWaitStatus } from "@/components/common/model-wait-status";
import { Button } from "@/components/ui/button";
import type { AssistThread, AssistTurn } from "@/lib/assist-protocol";
import type { NoteTag } from "@/lib/types";
import { AnswerActions } from "./answer-actions";
import { AnswerCard } from "./answer-card";
import type { RunOptions } from "./assist-thread";
import type { Citation } from "./citations";
import type { LiveExchange } from "./use-assist";
import type { TargetChip } from "./target-chip";
import { TargetChipView } from "./target-chip-view";

export type ExchangeActions = {
  followUp: (question: string) => void;
  rerun: (options: RunOptions) => void;
  askAgain: () => void;
  remove: () => void;
  askClaude: () => void;
  stop: () => void;
  saveNote: (line: number | null, tag: NoteTag, body: string) => void;
};

type ExchangeViewProps = {
  exchange: AssistThread;
  headSha: string;
  live: LiveExchange | null;
  chip: TargetChip;
  commentLine: number | null;
  citationsOf: (turn: AssistTurn) => Citation[];
  onShowCitation: (citation: Citation) => void;
  actions: ExchangeActions;
};

function FailureNote({
  live,
  onRetry,
  onAskClaude,
}: {
  live: LiveExchange;
  onRetry: () => void;
  onAskClaude: () => void;
}) {
  const failure = live.failure;
  if (!failure) return null;
  const isUnavailable = failure.kind === "unavailable";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 p-4 text-sm">
      <p>
        <InlineMarkdown text={failure.message} />
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          {isUnavailable ? "Try again" : "Retry"}
        </Button>
        {isUnavailable && (
          <Button variant="ghost" size="sm" onClick={onAskClaude}>
            Ask Claude instead
          </Button>
        )}
      </div>
    </div>
  );
}

function OlderCommit({ headSha, onAskAgain }: { headSha: string; onAskAgain: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted-foreground">
      <span>
        Asked on an older commit <code>{headSha.slice(0, 7)}</code>. The lines have changed since.
      </span>
      <Button variant="outline" size="sm" onClick={onAskAgain}>
        Ask again on the new code
      </Button>
    </div>
  );
}

export function ExchangeView({
  exchange,
  headSha,
  live,
  chip,
  commentLine,
  citationsOf,
  onShowCitation,
  actions,
}: ExchangeViewProps) {
  const isCurrent = live?.thread.id === exchange.id;
  const isStreaming = isCurrent && live.isStreaming;
  const failure = isCurrent ? live.failure : null;
  const isReadOnly = exchange.headSha !== headSha;
  const last = exchange.turns.at(-1);
  const isAwaitingAnswer = last?.role === "reviewer";
  const canAct = !isStreaming && failure === null && last?.role === "model" && !isReadOnly;
  return (
    <article
      aria-label={`Question about ${chip.path ?? chip.text}`}
      className="flex flex-col gap-3"
    >
      <header className="flex items-center gap-2">
        <TargetChipView chip={chip} />
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          aria-label="Remove this question"
          onClick={actions.remove}
        >
          <X />
        </Button>
      </header>
      {exchange.turns.map((turn, index) => {
        const isFinal = index === exchange.turns.length - 1;
        if (turn.role === "reviewer")
          return (
            <Markdown
              key={index}
              text={turn.text}
              className="flex max-w-[88%] flex-col gap-2 self-end rounded-lg bg-accent px-3 py-2 text-accent-foreground"
            />
          );
        return (
          <AnswerCard
            key={index}
            turn={turn}
            isFinal={isFinal}
            isStreaming={isStreaming && isFinal}
            citationsOf={citationsOf}
            onShowCitation={onShowCitation}
          >
            {canAct && isFinal && (
              <AnswerActions
                text={turn.text}
                commentLine={commentLine}
                hasBudgetEnded={turn.hasBudgetEnded ?? false}
                onSaveNote={actions.saveNote}
                onFollowUp={actions.followUp}
                onRerun={actions.rerun}
                onAskClaude={actions.askClaude}
              />
            )}
          </AnswerCard>
        );
      })}
      {live && isStreaming && <ModelWaitStatus phase={live.phase} onStop={actions.stop} />}
      {failure && live && (
        <FailureNote
          live={live}
          onRetry={() => actions.rerun({})}
          onAskClaude={actions.askClaude}
        />
      )}
      {!isStreaming && failure === null && isAwaitingAnswer && !isReadOnly && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{live?.isStopped ? "Stopped before the answer started." : "No answer yet."}</span>
          <Button variant="outline" size="sm" onClick={() => actions.rerun({})}>
            Retry
          </Button>
        </div>
      )}
      {isReadOnly && <OlderCommit headSha={exchange.headSha} onAskAgain={actions.askAgain} />}
    </article>
  );
}
