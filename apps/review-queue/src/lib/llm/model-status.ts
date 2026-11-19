import { type LlmSettings, llmSettingsFromEnv } from "@/lib/settings/llm-settings";
import type { LlmBackend } from "./backends";
import { type Lane, readLaneStatus } from "./lanes";
import { type ModelServer, resolveLlm } from "./model-choice";
import { readModelStart } from "./model-start";
import { isModelAwake, readMeasuredSpeeds, type Speeds } from "./speeds";

export type ModelStatus = {
  isEnabled: boolean;
  backend: LlmBackend;
  server: ModelServer | null;
  model: string | null;
  size: string | null;
  isUsable: boolean;
  reason: string | null;
  isServerAnswering: boolean | null;
  isAwake: boolean;
  claudeModel: string;
  lanes: { running: Lane | null; queued: Record<Lane, number> };
  speeds: Speeds;
  start: { command: string | null; isStarting: boolean; failure: string | null };
};

export async function buildModelStatus(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  saved: LlmSettings | null,
): Promise<ModelStatus> {
  const { config, choice } = await resolveLlm(env, fetchImpl, saved);
  const isUsable = config.enabled && config.problem === null;
  const modelStart = readModelStart();
  return {
    isEnabled: config.enabled,
    backend: config.backend,
    server: choice?.server ?? null,
    model: config.model || null,
    size: choice?.size ?? null,
    isUsable,
    reason: choice?.reason ?? null,
    isServerAnswering: choice ? choice.served !== null : null,
    isAwake: isModelAwake(),
    claudeModel: (saved ?? llmSettingsFromEnv(env)).claudeModel,
    lanes: readLaneStatus(),
    speeds: readMeasuredSpeeds(),
    start: {
      command: choice?.startCommand?.join(" ") ?? null,
      isStarting: modelStart.isRunning && !isUsable,
      failure: isUsable ? null : modelStart.failure,
    },
  };
}
