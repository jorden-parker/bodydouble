import { Archive, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { cn } from "cn";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Stream } from "@/components/neon/stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CARD_CLASS } from "@/components/ui/card";
import { gitHubPullRequestUrl, parsePullRequestRef, prKey, prPath } from "@/lib/pr-ref";
import type { InProgressSession } from "@/lib/session/store";

export function relativeTime(iso: string): string {
  const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function InProgressRow({
  session,
  control,
}: {
  session: InProgressSession;
  control?: ReactNode;
}) {
  const ref = parsePullRequestRef(session.key);
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium wrap-anywhere">
          <InlineMarkdown text={session.title ?? session.key} />
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-label text-fg-muted">
          <span className="font-mono wrap-anywhere">{session.key}</span>
          <span>updated {relativeTime(session.updatedAt)}</span>
          {session.pauseNote && (
            <span className="wrap-anywhere">&ldquo;{session.pauseNote}&rdquo;</span>
          )}
        </span>
      </span>
      <Badge variant="blue" className="shrink-0">
        Resume, {session.doneCount} steps done
      </Badge>
    </>
  );
  return (
    <li
      className={cn(
        "flex min-w-0 items-center",
        ref &&
          "transition-colors duration-calm hover:bg-surface-2 has-[a:focus-visible]:bg-surface-2",
      )}
    >
      {ref ? (
        <Link href={prPath(ref)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">{body}</div>
      )}
      {ref && (
        <div className="shrink-0 pr-2">
          <HintButton
            variant="ghost"
            size="icon-sm"
            hint="Open on GitHub"
            aria-label={`Open ${prKey(ref)} on GitHub`}
            className="hover:bg-surface-3"
            asChild
          >
            <a href={gitHubPullRequestUrl(ref)} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
            </a>
          </HintButton>
        </div>
      )}
      {control && <div className="shrink-0 pr-2">{control}</div>}
    </li>
  );
}

const REVIEW_PHASES = [
  { label: "Orient" },
  { label: "Walk the changes" },
  { label: "Conversation" },
  { label: "Submit" },
];

const PHASE_ORIENT = 0;
const PHASE_WALK = 1;

function currentPhaseIndex(doneCount: number): number {
  return doneCount > 0 ? PHASE_WALK : PHASE_ORIENT;
}

function InProgressFeature({
  session,
  control,
  isResumePrimary,
}: {
  session: InProgressSession;
  control: ReactNode;
  isResumePrimary: boolean;
}) {
  const ref = parsePullRequestRef(session.key);
  return (
    <article className={cn(CARD_CLASS, "gap-6")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 className="text-heading wrap-anywhere">
            <InlineMarkdown text={session.title ?? session.key} />
          </h3>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-label text-fg-muted">
            <span className="font-mono text-fg wrap-anywhere">{session.key}</span>
            <span>updated {relativeTime(session.updatedAt)}</span>
            {session.pauseNote && (
              <span className="wrap-anywhere">&ldquo;{session.pauseNote}&rdquo;</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {ref && (
            <HintButton
              variant="ghost"
              size="icon-sm"
              hint="Open on GitHub"
              aria-label={`Open ${prKey(ref)} on GitHub`}
              asChild
            >
              <a href={gitHubPullRequestUrl(ref)} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
              </a>
            </HintButton>
          )}
          {control}
        </div>
      </div>
      <Stream
        steps={REVIEW_PHASES}
        currentIndex={currentPhaseIndex(session.doneCount)}
        label="Review progress"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="blue">{session.doneCount} steps done</Badge>
        {ref && (
          <Button variant={isResumePrimary ? "default" : "soft"} asChild>
            <Link href={prPath(ref)}>
              Resume review <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

export function InProgressList({
  sessions,
  busy,
  onArchive,
  headingRef,
  isResumePrimary = true,
}: {
  sessions: InProgressSession[];
  busy: boolean;
  onArchive: (session: InProgressSession) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  isResumePrimary?: boolean;
}) {
  if (sessions.length === 0) return null;
  const [featured, ...others] = sessions;
  const archiveButton = (session: InProgressSession) => (
    <HintButton
      variant="ghost"
      size="icon-sm"
      hint="Move to Archived"
      aria-label={`Archive ${session.key}`}
      disabled={busy}
      onClick={() => onArchive(session)}
    >
      <Archive />
    </HintButton>
  );
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="text-heading">
        In progress <span className="tabular-nums text-fg-muted">({sessions.length})</span>
      </h2>
      <InProgressFeature
        session={featured}
        control={archiveButton(featured)}
        isResumePrimary={isResumePrimary}
      />
      {others.length > 0 && (
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-heading">
            Also in Progress <span className="tabular-nums text-fg-muted">({others.length})</span>
          </h3>
          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
            {others.map((session) => (
              <InProgressRow key={session.key} session={session} control={archiveButton(session)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
