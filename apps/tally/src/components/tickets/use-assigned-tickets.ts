import { useEffect, useState } from "react";
import type { AssignedStory } from "@/lib/store/assigned-stories";
import { messageOf, type TallyApi } from "../api";
import { describeSyncErrors, useSync } from "../sync/use-sync";

export function useAssignedTickets(api: TallyApi) {
  const [stories, setStories] = useState<AssignedStory[] | null>(null);
  const { syncing, problems, setProblems, completedSyncs, sync } = useSync(api, describeSyncErrors);

  useEffect(() => {
    let current = true;
    api
      .fetchAssignedStories()
      .then((loaded) => current && setStories(loaded))
      .catch((error) => current && setProblems([messageOf(error)]));
    return () => {
      current = false;
    };
  }, [api, completedSyncs, setProblems]);

  return { stories, problems, syncing, sync };
}
