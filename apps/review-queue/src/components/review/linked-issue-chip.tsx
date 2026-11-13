"use client";

import { Ticket } from "lucide-react";
import type { LinkedIssue } from "@/lib/github/gh";
import { issueLabel } from "./linked-issues";

export function LinkedIssueChip({ issues }: { issues: LinkedIssue[] }) {
  const [first] = issues;
  if (!first) return null;
  const otherCount = issues.length - 1;
  return (
    <a
      href={first.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-pill border border-neon-amber/50 bg-tint-amber px-3 text-sm font-bold text-fg no-underline hover:brightness-105"
    >
      <Ticket aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        {issueLabel(first)} · {first.title}
      </span>
      {otherCount > 0 && <span className="shrink-0 text-fg-muted">+{otherCount}</span>}
    </a>
  );
}
