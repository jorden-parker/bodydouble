"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ModelLoading = { status: "loading" };
type ModelFailure = { status: "error"; message: string };

export function useModelResult<Result extends { status: string }>(load: () => Promise<Result>) {
  const [state, setState] = useState<Result | ModelLoading | ModelFailure>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    load()
      .then((result) => current && setState(result))
      .catch((error: Error) => current && setState({ status: "error", message: error.message }));
    return () => {
      current = false;
    };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}

export function ModelUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
      <p role="status">Local model unavailable ({message}).</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
