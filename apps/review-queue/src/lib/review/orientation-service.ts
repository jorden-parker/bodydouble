import type { LlmConfig } from "@/lib/llm/client";
import {
  orient,
  orientFromSummaries,
  OrientationRecordSchema,
  type Orientation,
  type OrientationInput,
  type StepSummary,
} from "@/lib/llm/orientation";
import { logServerError } from "@/lib/log";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import type { PullRequestRef } from "@/lib/types";
import { explanationFor } from "./explanation-service";
import { cachedModelResult, storedModelResult } from "./model-cache";
import type { ReviewData } from "./prepare";

export type OrientationResult =
  | { status: "ready"; orientation: Orientation }
  | { status: "disabled" }
  | { status: "error"; message: string };

const ORIENTATION_CACHE_VERSION = 5;

function cacheKey(ref: PullRequestRef, headSha: string, config: LlmConfig): string {
  return `orientation:v${ORIENTATION_CACHE_VERSION}:${prKey(ref)}:${headSha}:${config.model}`;
}

function orientationInput(data: ReviewData): OrientationInput {
  return {
    title: data.pr.title,
    body: data.pr.body,
    diffs: data.files,
    steps: data.steps,
    hotspots: data.hotspots,
  };
}

export function storedOrientationFor(
  ref: PullRequestRef,
  headSha: string,
  store: SessionStore,
  config: LlmConfig,
): Orientation | null {
  return storedModelResult(store, cacheKey(ref, headSha, config), OrientationRecordSchema);
}

export function storedOrientation(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
): Orientation | null {
  return storedOrientationFor(data.pr.ref, data.headSha, store, config);
}

async function explainEachStep(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<StepSummary[]> {
  const summaries: StepSummary[] = [];
  for (const step of data.steps) {
    signal?.throwIfAborted();
    const result = await explanationFor(data, step.id, store, config, fetchImpl, signal);
    if (result.status !== "ready") {
      throw new Error(result.status === "error" ? result.message : "The local model is off");
    }
    summaries.push({ stepId: step.id, what: result.explanation.what });
  }
  return summaries;
}

async function generateOrientation(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Orientation> {
  const input = orientationInput(data);
  if (config.backend === "claude-code") return orient(input, config, fetchImpl, signal);
  const summaries = await explainEachStep(data, store, config, fetchImpl, signal);
  return orientFromSummaries(input, summaries, config, fetchImpl, signal);
}

export async function orientationFor(
  data: ReviewData,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<OrientationResult> {
  if (!config.enabled) return { status: "disabled" };
  try {
    const orientation = await cachedModelResult(
      store,
      cacheKey(data.pr.ref, data.headSha, config),
      OrientationRecordSchema,
      () => generateOrientation(data, store, config, fetchImpl, signal),
    );
    return { status: "ready", orientation };
  } catch (error) {
    logServerError(`orientation ${prKey(data.pr.ref)}`, error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
