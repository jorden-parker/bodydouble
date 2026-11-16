"use client";

import { useEffect, useState } from "react";
import { fetchModelStatus } from "@/components/review/api";
import type { ModelStatus } from "@/lib/llm/model-status";

const POLL_MS = 15_000;

export function useModelStatus(): ModelStatus | null {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      fetchModelStatus().then(setStatus, () => setStatus(null));
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer !== undefined) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  return status;
}
