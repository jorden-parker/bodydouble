"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SessionAction } from "@/lib/review/session-actions";
import type { PullRequestRef } from "@/lib/types";
import { postSessionAction } from "./queue-actions";

export function useSessionChange(ref: PullRequestRef) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  function change(action: SessionAction) {
    setFailure(null);
    startTransition(async () => {
      try {
        await postSessionAction(ref, action);
        router.refresh();
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return { change, isPending, failure };
}
