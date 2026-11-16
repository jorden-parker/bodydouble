"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { postRefresh } from "./queue-actions";
import { relativeTime } from "./time";
import { useQueueKeys } from "./use-queue-keys";

const SECONDS_MS = 1000;

export function QueueFrame({ loadedAt, children }: { loadedAt: string; children: ReactNode }) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  useQueueKeys(container);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), SECONDS_MS);
    return () => window.clearInterval(timer);
  }, []);

  function refresh() {
    setFailure(null);
    startTransition(async () => {
      try {
        await postRefresh();
        router.refresh();
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <div ref={container} className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3 text-label text-fg-muted">
        <span aria-live="polite" className="whitespace-nowrap">
          Updated {relativeTime(loadedAt, now)}
        </span>
        <Button variant="soft" size="sm" data-queue-refresh disabled={isPending} onClick={refresh}>
          <RefreshCw
            aria-hidden="true"
            className={isPending ? "motion-safe:animate-spin" : undefined}
          />
          Refresh <Kbd>r</Kbd>
        </Button>
        {failure && <span className="text-destructive">{failure}</span>}
      </div>
      {children}
    </div>
  );
}
