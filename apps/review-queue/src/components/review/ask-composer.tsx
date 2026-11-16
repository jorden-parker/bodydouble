"use client";

import { useState } from "react";
import type { ModelChip } from "@/components/common/model-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AssistTarget } from "@/lib/assist-protocol";
import { TargetChipView } from "./target-chip-view";
import type { TargetChip } from "./target-chip";

const NBSP = " ";

function placeholderOf(target: AssistTarget): string {
  if (target.kind === "lines") return "Ask about these lines…";
  if (target.kind === "file") return "Ask about this file…";
  return "Ask about this check…";
}

type AskComposerProps = {
  target: AssistTarget | null;
  chip: TargetChip | null;
  model: ModelChip | null;
  isBusy: boolean;
  onSend: (question: string) => void;
};

export function AskComposer({ target, chip, model, isBusy, onSend }: AskComposerProps) {
  const [text, setText] = useState("");
  if (target === null || chip === null)
    return (
      <section
        aria-label="Ask about this PR"
        className="border-t border-line-soft p-4 text-sm text-muted-foreground"
      >
        <p>Pick a step or select lines in it first, then ask about exactly those.</p>
      </section>
    );
  const question = text.trim();
  const send = () => {
    if (question === "" || isBusy) return;
    onSend(question);
    setText("");
  };
  return (
    <section
      aria-label="Ask about this"
      className="flex flex-col gap-2 border-t border-line-soft p-3"
    >
      <Textarea
        aria-label="Your question"
        rows={2}
        placeholder={placeholderOf(target)}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <TargetChipView chip={chip} />
        {model && (
          <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-0.5">
            {model.name}
            {NBSP}· {model.place}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={isBusy || question === ""}
          onClick={send}
        >
          Ask
        </Button>
      </div>
    </section>
  );
}
