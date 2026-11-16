"use client";

import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { AssistAction } from "@/lib/assist-protocol";
import { ASSIST_ACTION_BUTTONS } from "./assist-actions";
import type { LineSelection } from "./use-line-selection";

const SHORTCUT_KEYS: Partial<Record<AssistAction, string>> = { explain: "i" };

function AskLine({ onAsk }: { onAsk: (question: string) => void }) {
  const [text, setText] = useState("");
  return (
    <input
      aria-label="Ask about these lines"
      placeholder="Ask about these lines…  ↵"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        const question = text.trim();
        if (event.key !== "Enter" || question === "") return;
        event.preventDefault();
        onAsk(question);
        setText("");
      }}
      className="h-7 w-full min-w-0 rounded-md border bg-background px-2 text-sm"
    />
  );
}

export function SelectionToolbar({
  selection,
  aiEnabled,
  onNote,
  onAction,
  onAsk,
}: {
  selection: LineSelection;
  aiEnabled: boolean;
  onNote: (() => void) | null;
  onAction: (action: AssistAction) => void;
  onAsk: (question: string) => void;
}) {
  if (!aiEnabled && !onNote) return null;
  return (
    <div
      role="toolbar"
      aria-label="Work with the selected lines"
      style={{ top: selection.top, left: selection.left }}
      className="fixed z-30 flex w-80 max-w-[calc(100vw-2rem)] animate-step-enter flex-col gap-1 rounded-lg border bg-popover p-1.5"
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1">
        {aiEnabled &&
          ASSIST_ACTION_BUTTONS.map(({ action, label, icon }) => (
            <Button key={action} variant="ghost" size="xs" onClick={() => onAction(action)}>
              {icon} {label}
              {SHORTCUT_KEYS[action] && (
                <span className="whitespace-nowrap">
                  {" "}
                  <Kbd aria-hidden>{SHORTCUT_KEYS[action]}</Kbd>
                </span>
              )}
            </Button>
          ))}
        {onNote && (
          <Button variant="ghost" size="xs" onClick={onNote}>
            <MessageSquarePlus /> Note <Kbd aria-hidden>c</Kbd>
          </Button>
        )}
      </div>
      {aiEnabled && <AskLine onAsk={onAsk} />}
    </div>
  );
}
