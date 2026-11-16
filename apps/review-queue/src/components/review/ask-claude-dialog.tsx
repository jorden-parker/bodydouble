"use client";

import { AppDialog } from "@/components/common/app-dialog";
import { Button } from "@/components/ui/button";
import type { TargetChip } from "./target-chip";

const NBSP = " ";

type AskClaudeDialogProps = {
  question: string;
  chip: TargetChip;
  lineCount: number;
  claudeModel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AskClaudeDialog({
  question,
  chip,
  lineCount,
  claudeModel,
  onConfirm,
  onCancel,
}: AskClaudeDialogProps) {
  const place = chip.path ? `${chip.path} ${chip.text}` : chip.text;
  return (
    <AppDialog title="Send this question to Claude?" onClose={onCancel}>
      <p className="text-sm">
        This leaves your machine and goes to Anthropic through the <code>claude</code> CLI, using
        the {claudeModel} model from Settings:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>your question: {question}</li>
        <li>
          {place}, with {lineCount}
          {NBSP}diff {lineCount === 1 ? "line" : "lines"}
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Nothing else in the repository is sent. Only this one question.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" autoFocus onClick={onCancel}>
          Keep it local
        </Button>
        <Button variant="outline" onClick={onConfirm}>
          Send to Claude ({claudeModel})
        </Button>
      </div>
    </AppDialog>
  );
}
