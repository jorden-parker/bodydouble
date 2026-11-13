import { useEffect, useRef, useState } from "react";
import type { Range, Summary } from "@/lib/metrics/summary";
import type { Settings } from "@/lib/store/settings";
import type { SyncResult } from "@/lib/sync";
import { messageOf, type TallyApi } from "../api";
import { describeSyncErrors, useSync } from "../sync/use-sync";
import { isStale } from "./format";

const AUTO_SYNC_MAX_AGE_MS = 10 * 60 * 1000;

function describeUncountedReviews(repos: string[]): string[] {
  return repos.length === 0
    ? []
    : [`Reviews in ${repos.join(", ")} aren't counted. Add them in Settings to count them.`];
}

function describeDashboardSync(result: SyncResult): string[] {
  return [...describeSyncErrors(result), ...describeUncountedReviews(result.uncountedReviewRepos)];
}

export function useDashboard(api: TallyApi, now: () => Date) {
  const [range, setRange] = useState<Range>("week");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const autoSyncAttempted = useRef(false);
  const { syncing, problems, setProblems, completedSyncs, sync } = useSync(
    api,
    describeDashboardSync,
  );

  useEffect(() => {
    let current = true;
    api
      .fetchSummary(range)
      .then((loaded) => current && setSummary(loaded))
      .catch((error) => current && setProblems([messageOf(error)]));
    return () => {
      current = false;
    };
  }, [api, range, completedSyncs, setProblems]);

  useEffect(() => {
    api
      .fetchSettings()
      .then(setSettings)
      .catch((error) => setProblems([messageOf(error)]));
  }, [api, setProblems]);

  useEffect(() => {
    if (autoSyncAttempted.current || !summary || !settings) return;
    const due = isStale(summary.lastSyncedAt, now(), AUTO_SYNC_MAX_AGE_MS);
    if (!due) {
      autoSyncAttempted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      autoSyncAttempted.current = true;
      void sync();
    }, 0);
    return () => clearTimeout(timer);
  }, [summary, settings, now, sync]);

  return { range, setRange, summary, settings, syncing, problems, sync };
}
