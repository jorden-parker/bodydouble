import type { LlmConfig } from "@/lib/llm/client";
import type { SessionStore } from "@/lib/session/store";
import { savedPreparationSetting } from "@/lib/settings/preparation-settings";
import type { PullRequestRef } from "@/lib/types";
import { orientationFor } from "./orientation-service";
import type { ReviewPayload } from "./prepare";

export type PreparationStatus = "prepared" | "busy" | "off";

export type PreparationDeps = {
  store: SessionStore;
  config: LlmConfig;
  load: (ref: PullRequestRef) => Promise<ReviewPayload>;
  fetchImpl: typeof fetch;
};

const globals = globalThis as { reviewQueuePreparing?: boolean };

export async function prepareReview(
  ref: PullRequestRef,
  deps: PreparationDeps,
  signal?: AbortSignal,
): Promise<PreparationStatus> {
  if (!savedPreparationSetting(deps.store)) return "off";
  if (globals.reviewQueuePreparing) return "busy";
  globals.reviewQueuePreparing = true;
  try {
    const review = await deps.load(ref);
    await orientationFor(review, deps.store, deps.config, deps.fetchImpl, signal);
    return "prepared";
  } finally {
    globals.reviewQueuePreparing = false;
  }
}
