import { z } from "zod";
import { CHANGES_CHAR_BUDGET, summarizeChanges } from "@/lib/llm/changes-summary";
import { diffText, type LlmConfig } from "@/lib/llm/client";
import { logServerError } from "@/lib/log";
import { prKey } from "@/lib/pr-ref";
import type { SessionStore } from "@/lib/session/store";
import { cachedModelResult, storedModelResult } from "./model-cache";
import { interdiffFor, type Interdiff } from "./interdiff";
import type { PreparedReview } from "./prepare";

export type ChangesSummary = { summary: string; model: string };

export type ChangesSummaryResult =
  | { status: "ready"; summary: ChangesSummary }
  | { status: "skipped" }
  | { status: "disabled" }
  | { status: "error"; message: string };

const CHANGES_SUMMARY_CACHE_VERSION = 1;

const ChangesSummarySchema = z.object({ summary: z.string(), model: z.string() });

function cacheKey(review: PreparedReview, baselineHeadSha: string, config: LlmConfig): string {
  const { headSha } = review.data;
  return `changes-summary:v${CHANGES_SUMMARY_CACHE_VERSION}:${prKey(review.data.pr.ref)}:${baselineHeadSha}:${headSha}:${config.model}`;
}

function fitsBudget({ files }: Interdiff): boolean {
  return files.length > 0 && diffText(files).length <= CHANGES_CHAR_BUDGET;
}

export async function changesSummaryFor(
  review: PreparedReview,
  baselineHeadSha: string,
  store: SessionStore,
  config: LlmConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ChangesSummaryResult> {
  if (!config.enabled) return { status: "disabled" };
  const key = cacheKey(review, baselineHeadSha, config);
  try {
    const cached = storedModelResult(store, key, ChangesSummarySchema);
    if (cached) return { status: "ready", summary: cached };
    const interdiff = await interdiffFor(review, baselineHeadSha);
    if (!fitsBudget(interdiff)) return { status: "skipped" };
    const summary = await cachedModelResult(store, key, ChangesSummarySchema, async () => ({
      summary: await summarizeChanges(
        { title: review.data.pr.title, files: interdiff.files },
        config,
        fetchImpl,
        signal,
      ),
      model: config.model,
    }));
    return { status: "ready", summary };
  } catch (error) {
    logServerError(`changes summary ${prKey(review.data.pr.ref)}`, error);
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
