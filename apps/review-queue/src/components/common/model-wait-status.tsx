"use client";

import { useEffect, useState } from "react";
import type { AssistPhase } from "@/lib/assist-protocol";
import { Button } from "@/components/ui/button";
import { waitView } from "./model-wait";

const TICK_MS = 1000;

export function ModelWaitStatus({
  phase,
  onStop,
}: {
  phase: AssistPhase | null;
  onStop?: () => void;
}) {
  return <WaitClock key={JSON.stringify(phase)} phase={phase} onStop={onStop} />;
}

function WaitClock({ phase, onStop }: { phase: AssistPhase | null; onStop?: () => void }) {
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), TICK_MS);
    return () => clearInterval(timer);
  }, [startedAt]);
  const view = waitView(phase, elapsed);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse"
        />
        <p role="status" className="whitespace-nowrap font-medium">
          {view.label}
        </p>
        {onStop && (
          <Button variant="outline" size="xs" className="ml-auto" onClick={onStop}>
            Stop
          </Button>
        )}
      </div>
      <p className="text-muted-foreground">{view.detail}</p>
      {view.percent !== null && (
        <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${view.percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
