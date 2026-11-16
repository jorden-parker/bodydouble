import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import type { InProgressSession } from "@/lib/session/store";
import { InProgressRow } from "./in-progress-list";

export function ArchivedList({
  sessions,
  busy,
  onRestore,
  summaryRef,
}: {
  sessions: InProgressSession[];
  busy: boolean;
  onRestore: (session: InProgressSession) => void;
  summaryRef: RefObject<HTMLElement | null>;
}) {
  if (sessions.length === 0) return null;
  return (
    <details>
      <summary ref={summaryRef} className="flex min-h-10 cursor-pointer items-center text-heading">
        Archived <span className="ml-2 tabular-nums text-fg-muted">({sessions.length})</span>
      </summary>
      <div className="grid gap-3 pt-3">
        <p className="text-sm text-fg-muted">
          Archived sessions stay out of &ldquo;Also in Progress&rdquo; until you restore them or
          push a new commit to the PR.
        </p>
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
          {sessions.map((session) => (
            <InProgressRow
              key={session.key}
              session={session}
              control={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Restore ${session.key}`}
                  disabled={busy}
                  onClick={() => onRestore(session)}
                >
                  Restore
                </Button>
              }
            />
          ))}
        </ul>
      </div>
    </details>
  );
}
