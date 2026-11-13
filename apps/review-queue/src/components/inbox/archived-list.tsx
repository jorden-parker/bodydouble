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
      <summary
        ref={summaryRef}
        className="flex min-h-11 cursor-pointer items-center font-display text-lg font-semibold"
      >
        Archived <span className="ml-s-2 tabular-nums text-fg-muted">({sessions.length})</span>
      </summary>
      <div className="grid gap-s-3 pt-s-3">
        <p className="text-sm text-fg-muted">
          Archived sessions stay out of &ldquo;Also in Progress&rdquo; until you restore them or
          push a new commit to the PR.
        </p>
        <ul className="grid max-h-80 gap-s-2 overflow-y-auto">
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
