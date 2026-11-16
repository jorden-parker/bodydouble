"use client";

import { Bot, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { type CitationRenderer, InlineMarkdown, Markdown } from "@/components/common/markdown-text";
import type { AssistLookup, AssistTurn } from "@/lib/assist-protocol";
import { CitationChip, CitationWalk } from "./citation-walk";
import type { Citation } from "./citations";

type AnswerCardProps = {
  turn: AssistTurn;
  isStreaming: boolean;
  isFinal: boolean;
  citationsOf: (turn: AssistTurn) => Citation[];
  onShowCitation: (citation: Citation) => void;
  children?: ReactNode;
};

function LookupList({ lookups = [] }: { lookups?: AssistLookup[] }) {
  if (lookups.length === 0) return null;
  return (
    <ul aria-label="Lookups" className="flex flex-col gap-0.5 text-sm text-muted-foreground">
      {lookups.map((lookup, index) => (
        <li key={index} className="flex items-start gap-1.5">
          <Search className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="min-w-0">
            <InlineMarkdown text={lookup.label} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function citationRenderer(
  citations: Citation[],
  activeIndex: number | null,
  showCitation: (index: number) => void,
): CitationRenderer {
  return {
    indexOf: (code) => {
      const index = citations.findIndex((citation) => citation.code === code);
      return index === -1 ? null : index;
    },
    render: (index, code) => {
      const citation = citations[index];
      if (!citation) return code;
      return (
        <CitationChip
          citation={citation}
          active={index === activeIndex}
          onShow={() => showCitation(index)}
        />
      );
    },
  };
}

function endNote(turn: AssistTurn): string | null {
  if (turn.ended === "stopped") return "Stopped before the answer finished.";
  if (turn.ended === "failed") return "The answer was cut off.";
  return null;
}

export function AnswerCard({
  turn,
  isStreaming,
  isFinal,
  citationsOf,
  onShowCitation,
  children,
}: AnswerCardProps) {
  const citations = useMemo(() => citationsOf(turn), [citationsOf, turn]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const showCitation = (index: number) => {
    const citation = citations[index];
    if (!citation) return;
    setActiveIndex(index);
    onShowCitation(citation);
  };
  const note = endNote(turn);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bot aria-hidden className="size-4 text-fg-muted" />
        {turn.isFromClaude && (
          <span className="whitespace-nowrap rounded-full border border-line px-2 text-xs">
            From Claude
          </span>
        )}
      </div>
      <LookupList lookups={turn.lookups} />
      <Markdown
        text={turn.text}
        className="flex flex-col gap-2"
        citations={citationRenderer(citations, activeIndex, showCitation)}
      />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {turn.hasBudgetEnded && isFinal && (
        <p className="text-sm text-muted-foreground">
          The search used all its lookups, so some callers may not be checked.
        </p>
      )}
      {isStreaming && <span aria-hidden className="h-4 w-1.5 animate-pulse bg-primary" />}
      {isFinal && !isStreaming && (
        <CitationWalk citations={citations} activeIndex={activeIndex} onStep={showCitation} />
      )}
      {isFinal && !isStreaming && (
        <p className="text-sm text-muted-foreground">The model&apos;s guess, unverified.</p>
      )}
      {children}
    </div>
  );
}
