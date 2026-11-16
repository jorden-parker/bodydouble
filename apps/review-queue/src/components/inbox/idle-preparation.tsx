"use client";

import { useEffect } from "react";
import { postPreparation } from "./queue-actions";

export const IDLE_MS = 30_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll"] as const;

export function IdlePreparation({ pullRequestKey }: { pullRequestKey: string }) {
  useEffect(() => {
    let timer = 0;
    let request: AbortController | null = null;

    function stop() {
      window.clearTimeout(timer);
      request?.abort();
      request = null;
    }

    function start() {
      if (document.visibilityState === "hidden" || request) return;
      request = new AbortController();
      postPreparation(pullRequestKey, request.signal).catch(() => undefined);
    }

    function waitForIdle() {
      stop();
      timer = window.setTimeout(start, IDLE_MS);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") stop();
      else waitForIdle();
    }

    waitForIdle();
    for (const name of ACTIVITY_EVENTS)
      window.addEventListener(name, waitForIdle, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, waitForIdle);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pullRequestKey]);
  return null;
}
