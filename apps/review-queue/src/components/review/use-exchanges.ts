"use client";

import { useCallback, useMemo } from "react";
import type { AssistThread } from "@/lib/assist-protocol";
import { withExchange, withoutExchange } from "./exchanges";
import type { Act } from "./use-step-navigation";

export function useExchanges(act: Act) {
  const save = useCallback(
    (thread: AssistThread) => {
      const updatedAt = new Date().toISOString();
      act({ type: "assist-save", thread }, (current) => withExchange(current, thread, updatedAt));
    },
    [act],
  );

  const remove = useCallback(
    (id: string) => act({ type: "assist-delete", id }, (current) => withoutExchange(current, id)),
    [act],
  );

  return useMemo(() => ({ save, remove }), [save, remove]);
}
