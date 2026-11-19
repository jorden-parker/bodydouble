"use client";

import { useEffect, useRef, useState } from "react";
import { modelChipOf } from "@/components/common/model-chip";
import { Kbd } from "@/components/ui/kbd";
import { useModelStatus } from "@/components/common/use-model-status";
import type { AssistTarget, AssistThread, AssistTurn } from "@/lib/assist-protocol";
import { linesInRange, targetCommentLine, targetPath } from "@/lib/assist-protocol";
import type { ReviewPayload } from "@/lib/review/prepare";
import type { Hunk } from "@/lib/types";
import { AskClaudeDialog } from "./ask-claude-dialog";
import { AskComposer } from "./ask-composer";
import { type ExchangeActions, ExchangeView } from "./ask-exchange";
import { citationsInText, parseCitation } from "./citations";
import { targetChipOf } from "./target-chip";
import { useStickToBottom } from "./use-stick-to-bottom";
import type { Workspace } from "./use-workspace";

type AskPanelProps = { review: ReviewPayload; workspace: Workspace };

function hunksOf(workspace: Workspace, target: AssistTarget): Hunk[] {
  return workspace.files.get(targetPath(target))?.hunks ?? [];
}

function stepNumberOf(review: ReviewPayload, stepId: string): number | null {
  const index = review.steps.findIndex((step) => step.id === stepId);
  return index === -1 ? null : index + 1;
}

function chipOf(review: ReviewPayload, workspace: Workspace, target: AssistTarget) {
  const stepNumber = target.kind === "check" ? stepNumberOf(review, target.stepId) : null;
  return targetChipOf(target, hunksOf(workspace, target), stepNumber);
}

function composerTargetOf(workspace: Workspace): AssistTarget | null {
  if (workspace.page !== "step") return null;
  if (workspace.selection) return { kind: "lines", range: workspace.selection.range };
  const stepPaths = workspace.currentStep?.files.map((file) => file.path) ?? [];
  if (workspace.askTarget && stepPaths.includes(targetPath(workspace.askTarget)))
    return workspace.askTarget;
  const file = workspace.currentStep?.files[0];
  return file ? { kind: "file", path: file.path } : null;
}

function totalLines(hunks: Hunk[]): number {
  return hunks.reduce((total, hunk) => total + hunk.lines.length, 0);
}

function diffLinesOf(review: ReviewPayload, workspace: Workspace, target: AssistTarget): number {
  if (target.kind === "lines")
    return linesInRange(hunksOf(workspace, target), target.range.from, target.range.to).length;
  if (target.kind === "file") return totalLines(hunksOf(workspace, target));
  const step = review.steps.find((candidate) => candidate.id === target.stepId);
  return (step?.files ?? []).reduce(
    (total, file) => total + totalLines(workspace.files.get(file.path)?.hunks ?? []),
    0,
  );
}

function questionOf(exchange: AssistThread): string {
  return exchange.turns.findLast((turn) => turn.role === "reviewer")?.text ?? "";
}

function citationsOfTurn(workspace: Workspace, target: AssistTarget, turn: AssistTurn) {
  const path = targetPath(target);
  const lookupPaths = (turn.lookups ?? []).flatMap((lookup) => lookup.paths);
  const knownPaths = [...workspace.files.keys(), ...lookupPaths];
  return citationsInText(turn.text, (code) =>
    parseCitation(code, knownPaths, path, [...workspace.files.values()]),
  );
}

export function AskPanel({ review, workspace }: AskPanelProps) {
  const { assist } = workspace;
  const [status] = useModelStatus();
  const model = modelChipOf(status);
  const target = composerTargetOf(workspace);
  const [claudeFor, setClaudeFor] = useState<AssistThread | null>(null);
  const claudeTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (claudeFor === null) claudeTrigger.current?.focus();
  }, [claudeFor]);
  const scrollKey = JSON.stringify([
    assist.exchanges.length,
    assist.live?.thread.turns.at(-1)?.text.length ?? 0,
    assist.live?.phase?.phase ?? null,
    assist.streaming,
    assist.live?.failure?.kind ?? null,
  ]);
  const { ref: listRef, onScroll, pin } = useStickToBottom(scrollKey);

  const send = (question: string) => {
    if (!target) return;
    pin();
    workspace.askAbout(target, question);
  };

  const actionsFor = (exchange: AssistThread): ExchangeActions => ({
    followUp: (question) => {
      pin();
      assist.followUp(exchange, question);
    },
    rerun: (options) => {
      pin();
      assist.rerun(exchange, options);
    },
    askAgain: () => assist.start(exchange.target, exchange.action, exchange.question),
    askClaude: () => {
      claudeTrigger.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setClaudeFor(exchange);
    },
    remove: () => assist.remove(exchange.id),
    stop: assist.stop,
    saveNote: (line, tag, body) =>
      workspace.saveNote(
        line === null ? null : { path: targetPath(exchange.target), line },
        tag,
        body,
      ),
  });

  return (
    <section
      aria-label="Ask the model"
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        ref={listRef}
        onScroll={onScroll}
        data-testid="chat-messages"
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
      >
        {assist.exchanges.length === 0 ? (
          <p className="m-auto max-w-prose text-center text-sm text-balance text-muted-foreground">
            Ask about this step, or select lines and{" "}
            <span className="whitespace-nowrap">
              press <Kbd>i</Kbd>
            </span>{" "}
            to ask about just those.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              The model&apos;s guess, unverified. The PR author can sway it.
            </p>
            {assist.exchanges.map((exchange) => (
              <ExchangeView
                key={exchange.id}
                exchange={exchange}
                headSha={review.headSha}
                live={assist.live?.thread.id === exchange.id ? assist.live : null}
                chip={chipOf(review, workspace, exchange.target)}
                commentLine={targetCommentLine(
                  hunksOf(workspace, exchange.target),
                  exchange.target,
                )}
                citationsOf={(turn) => citationsOfTurn(workspace, exchange.target, turn)}
                onShowCitation={(citation) =>
                  workspace.openLocation({
                    path: citation.path,
                    line: citation.line,
                    endLine: citation.endLine,
                  })
                }
                actions={actionsFor(exchange)}
              />
            ))}
          </>
        )}
      </div>
      <AskComposer
        target={target}
        chip={target ? chipOf(review, workspace, target) : null}
        model={model}
        isBusy={assist.streaming}
        onSend={send}
      />
      {claudeFor && (
        <AskClaudeDialog
          question={questionOf(claudeFor)}
          chip={chipOf(review, workspace, claudeFor.target)}
          lineCount={diffLinesOf(review, workspace, claudeFor.target)}
          claudeModel={status?.claudeModel ?? "Claude"}
          onCancel={() => setClaudeFor(null)}
          onConfirm={() => {
            assist.rerun(claudeFor, { shouldEscalate: true });
            setClaudeFor(null);
          }}
        />
      )}
    </section>
  );
}
