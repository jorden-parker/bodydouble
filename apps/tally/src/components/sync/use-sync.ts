import { useCallback, useState } from "react";
import type { SyncResult } from "@/lib/sync";
import { messageOf, type TallyApi } from "../api";

const SOURCE_LABELS: Record<string, string> = { github: "GitHub", shortcut: "Shortcut" };

export function describeSyncErrors(result: SyncResult): string[] {
  return Object.entries(result.errors).map(
    ([source, message]) => `${SOURCE_LABELS[source] ?? source}: ${message}`,
  );
}

export function useSync(api: TallyApi, describeResult: (result: SyncResult) => string[]) {
  const [syncing, setSyncing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [completedSyncs, setCompletedSyncs] = useState(0);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await api.runSync();
      setProblems(describeResult(result));
      setCompletedSyncs((count) => count + 1);
    } catch (error) {
      setProblems([messageOf(error)]);
    } finally {
      setSyncing(false);
    }
  }, [api, describeResult]);

  return { syncing, problems, setProblems, completedSyncs, sync };
}
