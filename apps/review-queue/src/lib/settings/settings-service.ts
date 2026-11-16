import { z } from "zod";
import { chooseModel, type ModelChoice } from "@/lib/llm/model-choice";
import { jsonError } from "@/lib/http";
import type { SessionStore } from "@/lib/session/store";
import {
  type LlmSettings,
  LlmSettingsSchema,
  llmSettingsFromEnv,
  saveLlmSettings,
  savedLlmSettings,
} from "./llm-settings";
import { savedPreparationSetting, savePreparationSetting } from "./preparation-settings";
import { RepositoriesSchema, saveRepositories, savedRepositories } from "./repository-settings";

type Env = Record<string, string | undefined>;

export type SettingsView = {
  llm: LlmSettings;
  choice: ModelChoice;
  repositories: string[];
  prepareNext: boolean;
};

const SettingsUpdateSchema = z.object({
  llm: LlmSettingsSchema.optional(),
  repositories: RepositoriesSchema.optional(),
  prepareNext: z.boolean().optional(),
});

function currentLlmSettings(store: SessionStore, env: Env): LlmSettings {
  return savedLlmSettings(store) ?? llmSettingsFromEnv(env);
}

export async function settingsView(
  store: SessionStore,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<SettingsView> {
  return {
    llm: currentLlmSettings(store, env),
    choice: await chooseModel(env, fetchImpl, null),
    repositories: savedRepositories(store),
    prepareNext: savedPreparationSetting(store),
  };
}

export async function updateSettings(
  store: SessionStore,
  body: unknown,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const update = SettingsUpdateSchema.safeParse(body);
  if (!update.success) return jsonError(update.error.message, 400);
  if (update.data.llm) saveLlmSettings(store, update.data.llm);
  if (update.data.repositories) saveRepositories(store, update.data.repositories);
  if (update.data.prepareNext !== undefined) savePreparationSetting(store, update.data.prepareNext);
  return Response.json(await settingsView(store, env, fetchImpl));
}

export function clearCacheResponse(store: SessionStore): Response {
  return Response.json({ cleared: store.clearCache() });
}
