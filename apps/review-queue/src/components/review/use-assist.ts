"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssistAction,
  AssistFailureKind,
  AssistPhase,
  AssistTarget,
  AssistThread,
} from "@/lib/assist-protocol";
import type { PullRequestRef } from "@/lib/types";
import type { ParsedAssistStream } from "./assist-stream";
import { streamAssist } from "./api";
import {
  canFollowUp,
  openThread,
  type RunOptions,
  threadRequest,
  withEnding,
  withFollowUp,
  withModelText,
  withoutLastModelTurn,
} from "./assist-thread";

type AssistFailure = { kind: AssistFailureKind; message: string };

export type LiveExchange = {
  thread: AssistThread;
  phase: AssistPhase | null;
  failure: AssistFailure | null;
  isStreaming: boolean;
  isStopped: boolean;
};

type ExchangeStore = {
  save: (thread: AssistThread) => void;
  remove: (id: string) => void;
};

function failureOf(error: Error, kind: AssistFailureKind | null): AssistFailure {
  return { kind: kind ?? "failed", message: error.message };
}

export function useAssist(
  ref: PullRequestRef,
  headSha: string,
  saved: AssistThread[],
  store: ExchangeStore,
) {
  const [live, setLive] = useState<LiveExchange | null>(null);
  const controller = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(
    (next: AssistThread, options: RunOptions) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      let latest = next;
      let failure: AssistFailure | null = null;
      let failureKind: AssistFailureKind | null = null;
      setLive({ thread: next, phase: null, failure: null, isStreaming: true, isStopped: false });
      const onUpdate = (parsed: ParsedAssistStream) => {
        if (abort.signal.aborted) return;
        failureKind = parsed.failureKind ?? failureKind;
        if (parsed.text || parsed.lookups.length > 0)
          latest = withModelText(latest, parsed.text, {
            lookups: parsed.lookups,
            hasBudgetEnded: parsed.hasBudgetEnded,
            isFromClaude: options.shouldEscalate,
          });
        setLive({
          thread: latest,
          phase: parsed.phase ?? null,
          failure: null,
          isStreaming: true,
          isStopped: false,
        });
      };
      streamAssist(ref, headSha, threadRequest(next, options), onUpdate, abort.signal)
        .catch((error: Error) => {
          if (abort.signal.aborted) return;
          failure = failureOf(error, failureKind);
        })
        .finally(() => {
          latest = withEnding(latest, abort.signal.aborted ? "stopped" : failure ? "failed" : null);
          store.save(latest);
          if (controller.current === abort) {
            controller.current = null;
            setLive({
              thread: latest,
              phase: null,
              failure,
              isStreaming: false,
              isStopped: abort.signal.aborted,
            });
          }
        });
    },
    [ref, headSha, store],
  );

  const start = useCallback(
    (target: AssistTarget, action: AssistAction, question: string | null = null) => {
      run(openThread(target, action, headSha, question), {});
    },
    [run, headSha],
  );

  const followUp = useCallback(
    (exchange: AssistThread, question: string) => {
      if (exchange.headSha !== headSha || !canFollowUp(exchange)) return;
      run(withFollowUp(exchange, question), {});
    },
    [run, headSha],
  );

  const rerun = useCallback(
    (exchange: AssistThread, options: RunOptions) => {
      if (exchange.headSha !== headSha) return;
      run(withoutLastModelTurn(exchange), options);
    },
    [run, headSha],
  );

  const remove = useCallback(
    (id: string) => {
      if (live?.thread.id === id) controller.current?.abort();
      if (live?.thread.id === id) setLive(null);
      store.remove(id);
    },
    [live, store],
  );

  const exchanges = useMemo(() => {
    if (!live) return saved;
    const isSaved = saved.some((exchange) => exchange.id === live.thread.id);
    return isSaved
      ? saved.map((exchange) => (exchange.id === live.thread.id ? live.thread : exchange))
      : [...saved, live.thread];
  }, [saved, live]);

  return {
    exchanges,
    live,
    streaming: live?.isStreaming ?? false,
    start,
    followUp,
    rerun,
    stop,
    remove,
  };
}
