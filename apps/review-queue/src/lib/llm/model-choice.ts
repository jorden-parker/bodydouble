import { access } from "node:fs/promises";
import { totalmem } from "node:os";
import path from "node:path";
import { z } from "zod";
import { type LlmSettings, llmSettingsFromEnv } from "@/lib/settings/llm-settings";
import {
  type ClaudeLiteSize,
  findClaudeLiteHome,
  loadClaudeLiteSizes,
  computeBudgetGb,
  resolveMlxUrl,
  readWiredLimitMb,
  servedModelIdOf,
} from "./claude-lite";
import { type LlmConfig, llmConfigFromEnv } from "./client";

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;
type Machine = { memoryBytes: number; wiredLimitMb: number };
export type ModelServer = "omlx" | "ollama";
type SizeFit = {
  name: string;
  memoryGb: number | null;
  isFitting: boolean;
  isServed: boolean;
};

export type ModelChoice = {
  server: ModelServer;
  baseURL: string;
  served: string[] | null;
  model: string | null;
  size: string | null;
  hasThinkingByDefault: boolean;
  isUsable: boolean;
  reason: string;
  startCommand: string[] | null;
  budgetGb: number | null;
  sizes: SizeFit[];
};

type Candidate = {
  name: string;
  model: string;
  memoryGb: number | null;
  hasThinkingByDefault: boolean;
  isFitting: boolean;
  isServed: boolean;
};

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const MLX_PROBE_TIMEOUT_MS = 2_000;
const TAGS_TIMEOUT_MS = 5_000;
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const TagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });
const MlxModelsSchema = z.object({ data: z.array(z.object({ id: z.string() })) });

const currentMachine = (): Machine => ({
  memoryBytes: totalmem(),
  wiredLimitMb: readWiredLimitMb(),
});

async function ollamaModels(baseURL: string, fetchImpl: Fetch): Promise<string[]> {
  const response = await fetchImpl(`${baseURL}/api/tags`, {
    signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
  });
  const tags = TagsSchema.parse(await response.json());
  return tags.models.map((model) => model.name.replace(/:latest$/, ""));
}

async function fetchOmlxModels(env: Env, fetchImpl: Fetch): Promise<string[] | null> {
  try {
    const response = await fetchImpl(`${resolveMlxUrl(env)}/v1/models`, {
      signal: AbortSignal.timeout(MLX_PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return MlxModelsSchema.parse(await response.json()).data.map((model) => model.id);
  } catch {
    return null;
  }
}

async function readClaudeLiteSizes(env: Env): Promise<ClaudeLiteSize[]> {
  const home = await findClaudeLiteHome(env);
  if (!home) return [];
  return loadClaudeLiteSizes(home);
}

function modelNameFor(size: ClaudeLiteSize, server: ModelServer): string | null {
  if (server === "ollama") return size.model;
  return size.mlx ? servedModelIdOf(size.mlx) : null;
}

function fitsBudget(memoryGb: number | null, budgetGb: number | null): boolean {
  return budgetGb === null || memoryGb === null || memoryGb <= budgetGb;
}

function isLoopback(baseURL: string): boolean {
  try {
    return LOOPBACK_HOSTS.includes(new URL(baseURL).hostname);
  } catch {
    return false;
  }
}

const gigabytes = (value: number) => `${Number(value.toFixed(1))} GB`;

function sortSmallestFirst(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((first, second) => (first.memoryGb ?? 0) - (second.memoryGb ?? 0));
}

async function isOnPath(command: string, env: Env): Promise<boolean> {
  const directories = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const found = await Promise.all(
    directories.map((directory) =>
      access(path.join(directory, command)).then(
        () => true,
        () => false,
      ),
    ),
  );
  return found.includes(true);
}

async function findStartCommand(
  env: Env,
  served: string[] | null,
  candidates: Candidate[],
): Promise<string[]> {
  const shouldStartOllama =
    served === null && !(await isOnPath("omlx", env)) && (await isOnPath("ollama", env));
  if (shouldStartOllama) return ["ollama", "serve"];
  const smallest = sortSmallestFirst(candidates.filter((candidate) => candidate.isFitting))[0];
  return smallest ? ["cl", "serve", smallest.name] : ["cl", "serve"];
}

const isRunnable = (startCommand: string[]) =>
  startCommand[0] === "ollama" || startCommand.length === 3;

type Verdict = { isUsable: boolean; isStartable: boolean; reason: string };

function explainChoice(input: {
  explicitModel: string | null;
  served: string[] | null;
  baseURL: string;
  budgetGb: number | null;
  candidates: Candidate[];
  chosen: Candidate | null;
  startCommand: string[];
}): Verdict {
  const { explicitModel, served, baseURL, budgetGb, candidates, chosen, startCommand } = input;
  const startHint = `Start one with \`${startCommand.join(" ")}\`.`;
  if (served === null) {
    return {
      isUsable: false,
      isStartable: true,
      reason: `No model server answers at ${baseURL}. ${startHint}`,
    };
  }
  if (explicitModel) {
    return {
      isUsable: true,
      isStartable: false,
      reason: "Chosen by hand, in Settings or REVIEW_QUEUE_LLM_MODEL.",
    };
  }
  if (candidates.length === 0) {
    return {
      isUsable: false,
      isStartable: false,
      reason:
        "claude-lite was not found, so no model size is known. Set CLAUDE_LITE_HOME to its checkout, or REVIEW_QUEUE_LLM_MODEL.",
    };
  }
  if (chosen) {
    const limit = budgetGb === null ? "a remote server" : `the ${gigabytes(budgetGb)} budget`;
    return {
      isUsable: true,
      isStartable: false,
      reason: `${chosen.name} is the largest served size that fits ${limit}.`,
    };
  }
  const fitting = candidates.filter((candidate) => candidate.isFitting);
  if (fitting.length === 0) {
    const smallest = sortSmallestFirst(candidates)[0];
    const need = smallest.memoryGb === null ? "" : ` needs ${gigabytes(smallest.memoryGb)}`;
    return {
      isUsable: false,
      isStartable: false,
      reason: `No size fits the ${gigabytes(budgetGb ?? 0)} budget; the smallest, ${smallest.name},${need}.`,
    };
  }
  return {
    isUsable: false,
    isStartable: true,
    reason: `No size that fits is served. ${startHint}`,
  };
}

async function probeServer(
  env: Env,
  fetchImpl: Fetch,
): Promise<{ server: ModelServer; baseURL: string; served: string[] | null }> {
  const mlx = env.REVIEW_QUEUE_LLM_URL ? null : await fetchOmlxModels(env, fetchImpl);
  if (mlx) return { server: "omlx", baseURL: resolveMlxUrl(env), served: mlx };
  const baseURL = env.REVIEW_QUEUE_LLM_URL ?? env.OLLAMA_HOST ?? DEFAULT_OLLAMA_URL;
  return {
    server: "ollama",
    baseURL,
    served: await ollamaModels(baseURL, fetchImpl).catch(() => null),
  };
}

function listCandidates(
  sizes: ClaudeLiteSize[],
  server: ModelServer,
  served: string[] | null,
  budgetGb: number | null,
): Candidate[] {
  return sizes.flatMap((size): Candidate[] => {
    const model = modelNameFor(size, server);
    if (!model) return [];
    return [
      {
        name: size.name,
        model,
        memoryGb: size.memoryGb,
        hasThinkingByDefault: size.hasThinkingByDefault,
        isFitting: fitsBudget(size.memoryGb, budgetGb),
        isServed: served?.includes(model) ?? false,
      },
    ];
  });
}

function pickChoice(candidates: Candidate[], explicitModel: string | null): Candidate | null {
  if (explicitModel) {
    return candidates.find((candidate) => candidate.model === explicitModel) ?? null;
  }
  return (
    candidates
      .filter((candidate) => candidate.isServed && candidate.isFitting)
      .sort((first, second) => (second.memoryGb ?? 0) - (first.memoryGb ?? 0))[0] ?? null
  );
}

export async function chooseModel(
  env: Env,
  fetchImpl: Fetch,
  explicitModel: string | null,
  machine: Machine = currentMachine(),
): Promise<ModelChoice> {
  const { server, baseURL, served } = await probeServer(env, fetchImpl);
  const budgetGb = isLoopback(baseURL)
    ? computeBudgetGb(machine.memoryBytes, machine.wiredLimitMb)
    : null;
  const sizes = await readClaudeLiteSizes(env).catch(() => []);
  const candidates = listCandidates(sizes, server, served, budgetGb);
  const chosen = pickChoice(candidates, explicitModel);
  const startCommand = await findStartCommand(env, served, candidates);
  const verdict = explainChoice({
    explicitModel,
    served,
    baseURL,
    budgetGb,
    candidates,
    chosen,
    startCommand,
  });
  const canStart = verdict.isStartable && isLoopback(baseURL) && isRunnable(startCommand);
  return {
    server,
    baseURL,
    served,
    model: explicitModel ?? chosen?.model ?? null,
    size: chosen?.name ?? null,
    hasThinkingByDefault: chosen?.hasThinkingByDefault ?? false,
    isUsable: verdict.isUsable,
    reason: verdict.reason,
    startCommand: canStart ? startCommand : null,
    budgetGb,
    sizes: candidates.map(({ name, memoryGb, isFitting, isServed }) => ({
      name,
      memoryGb,
      isFitting,
      isServed,
    })),
  };
}

function resolveThinking(setting: LlmSettings["thinking"], hasThinkingByDefault: boolean): boolean {
  return setting === "model" ? hasThinkingByDefault : setting === "on";
}

export async function resolveLlm(
  env: Env = process.env,
  fetchImpl: Fetch = fetch,
  saved: LlmSettings | null = null,
): Promise<{ config: LlmConfig; choice: ModelChoice | null }> {
  const settings = saved ?? llmSettingsFromEnv(env);
  const { model, claudeModel, thinking, ...choices } = settings;
  const base = { ...llmConfigFromEnv(env), ...choices };
  if (base.backend === "claude-code") {
    const config = {
      ...base,
      model: claudeModel,
      thinking: resolveThinking(thinking, false),
      problem: null,
    };
    return { config, choice: null };
  }
  if (!base.enabled) {
    const config = {
      ...base,
      model: model ?? "",
      thinking: resolveThinking(thinking, false),
      problem: null,
    };
    return { config, choice: null };
  }
  const choice = await chooseModel(env, fetchImpl, model);
  const config = {
    ...base,
    baseURL: choice.baseURL,
    model: choice.model ?? "",
    thinking: resolveThinking(thinking, choice.hasThinkingByDefault),
    problem: choice.isUsable ? null : choice.reason,
  };
  return { config, choice };
}

export async function llmConfig(
  env: Env = process.env,
  fetchImpl: Fetch = fetch,
  saved: LlmSettings | null = null,
): Promise<LlmConfig> {
  return (await resolveLlm(env, fetchImpl, saved)).config;
}
