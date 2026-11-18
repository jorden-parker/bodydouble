"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { prKey, prPath } from "@/lib/pr-ref";
import { type QueueEntry, estimateReadingMinutes, sizeOf } from "./queue";
import { ReferenceLine } from "./queue-row";
import { useSessionChange } from "./use-session-change";

export function UpNext({ entry, reason, now }: { entry: QueueEntry; reason: string; now: number }) {
  const { request, facts } = entry;
  const { change, isPending, failure } = useSessionChange(request.ref);
  return (
    <section
      aria-label="Up next"
      data-queue-row
      data-queue-key={prKey(request.ref)}
      className="grid min-w-0 gap-4 rounded-xl border border-line-soft bg-card p-5"
    >
      <div className="grid gap-1">
        <h2 className="text-eyebrow">Up next</h2>
        <p className="text-sm text-fg-muted text-pretty">{reason}</p>
      </div>
      <div className="grid min-w-0 gap-2">
        <p className="text-lg font-semibold text-pretty">{request.title}</p>
        {entry.intent && (
          <p className="text-sm text-fg-muted text-pretty">
            Model&apos;s guess: <InlineMarkdown text={entry.intent} />
          </p>
        )}
        <ReferenceLine request={request} createdAt={facts?.createdAt ?? null} now={now} />
      </div>
      {facts && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <span className="sr-only">Size </span>
            {sizeOf(facts)}
          </Badge>
          <Badge variant="outline">
            +{facts.additions}&nbsp;−{facts.deletions}
          </Badge>
          {facts.checks === "passing" && <Badge variant="mint">Checks pass</Badge>}
          {facts.checks === "failing" && <Badge variant="coral">Checks failing</Badge>}
          {facts.checks === "running" && <Badge variant="amber">Checks running</Badge>}
          <Badge variant="outline">~{estimateReadingMinutes(facts)}&nbsp;min</Badge>
          <Badge variant="outline">{facts.changedFiles}&nbsp;files</Badge>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={prPath(request.ref)} data-queue-open>
            Start review <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button
          variant="outline"
          data-queue-action="snooze"
          disabled={isPending}
          onClick={() => change({ type: "snooze", until: { kind: "tomorrow" } })}
        >
          Not now <Kbd>s</Kbd>
        </Button>
        <Button variant="ghost" asChild>
          <a href={request.url} target="_blank" rel="noopener noreferrer">
            Open on GitHub <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
      {failure && <p className="text-label text-destructive">{failure}</p>}
    </section>
  );
}
