import { Archive, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { HintButton } from "@/components/common/hint-button";
import { InlineMarkdown } from "@/components/common/markdown-text";
import { Stream } from "@/components/neon/stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <span className="flex min-w-0 flex-1 flex-col gap-s-1">
        <span className="font-display font-semibold">
          <InlineMarkdown text={session.title ?? session.key} />
        </span>
        <span className="flex flex-wrap gap-x-s-3 text-sm text-fg-muted">
          <span>{session.key}</span>
          <span>updated {relativeTime(session.updatedAt)}</span>
          {session.pauseNote && <span>&ldquo;{session.pauseNote}&rdquo;</span>}
        </span>
      </span>
      <Badge variant="blue">Resume, {session.doneCount} steps done</Badge>
    </>
  );
  return (
    <li className="flex items-center rounded-md border border-line-soft bg-surface-2">
      {ref ? (
        <Link
          href={prPath(ref)}
          className="flex min-w-0 flex-1 items-center gap-s-4 rounded-md px-s-4 py-s-3 transition-colors duration-calm hover:bg-surface-3 focus-visible:bg-surface-3"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-s-4 px-s-4 py-s-3">{body}</div>
      )}
      {ref && (
        <div className="pr-s-3">
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
        </div>
      )}
      {control && <div className="pr-s-3">{control}</div>}
    </li>
  );
}

const REVIEW_PHASES = [
  { label: "Orient" },
  { label: "Walk the Changes" },
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
    <article className="grid gap-s-4 rounded-md border border-line bg-surface p-s-5">
      <div className="flex flex-wrap items-start justify-between gap-s-3">
        <div className="grid min-w-0 gap-s-1">
          <h3 className="font-display text-xl leading-snug font-semibold">
            <InlineMarkdown text={session.title ?? session.key} />
          </h3>
          <p className="flex flex-wrap gap-x-s-3 text-sm text-fg-muted">
            <span className="font-mono text-fg">{session.key}</span>
            <span>updated {relativeTime(session.updatedAt)}</span>
            {session.pauseNote && <span>&ldquo;{session.pauseNote}&rdquo;</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-s-1">
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
      <div className="flex flex-wrap items-center justify-between gap-s-3">
        <Badge variant="blue">{session.doneCount} steps done</Badge>
        {ref && (
          <Button variant={isResumePrimary ? "neon" : "soft"} asChild>
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
    <section className="grid gap-s-4">
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold">
        In Progress <span className="tabular-nums text-fg-muted">({sessions.length})</span>
      </h2>
      <InProgressFeature
        session={featured}
        control={archiveButton(featured)}
        isResumePrimary={isResumePrimary}
      />
      {others.length > 0 && (
        <div className="grid gap-s-3">
          <h3 className="font-display text-lg font-semibold">
            Also in Progress <span className="tabular-nums text-fg-muted">({others.length})</span>
          </h3>
          <ul className="grid max-h-80 gap-s-2 overflow-y-auto">
            {others.map((session) => (
              <InProgressRow key={session.key} session={session} control={archiveButton(session)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
