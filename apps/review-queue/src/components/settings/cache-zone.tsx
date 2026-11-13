"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearCache } from "./settings-api";
import { PanelHeading } from "./settings-fields";

export function CacheZone() {
  const [status, setStatus] = useState<string | null>(null);

  function clear() {
    clearCache()
      .then(({ cleared }) => setStatus(`Cleared ${cleared} cached entries.`))
      .catch((failure: Error) => setStatus(failure.message));
  }

  return (
    <>
      <PanelHeading icon={Trash2} title="Clear the Cache" isDanger />
      <div className="grid gap-s-2 text-sm">
        <p className="text-fg-muted">
          Removes saved orientations, step explanations and GitHub responses. They are fetched again
          the next time you open a PR.
        </p>
        <p className="flex items-center gap-s-2 font-bold">
          <Sparkles aria-hidden="true" className="size-5 shrink-0 text-ink-mint" />
          This only forgets saved copies. Your reviews are safe.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-s-3">
        <Button
          type="button"
          variant="soft"
          onClick={clear}
          className="border-ink-coral bg-surface text-ink-coral hover:bg-tint-coral"
        >
          <Trash2 aria-hidden="true" />
          Clear cache
        </Button>
        <p aria-live="polite" className="empty:hidden text-sm text-fg-muted">
          {status}
        </p>
      </div>
    </>
  );
}
