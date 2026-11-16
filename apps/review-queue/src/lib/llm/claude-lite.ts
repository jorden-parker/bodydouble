import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

type Env = Record<string, string | undefined>;
type JsonObject = Record<string, unknown>;

const DEFAULT_MLX_PORT = "8435";
const GIB = 1024 ** 3;
const METAL_BUDGET_FRACTION = 0.7;

const SizeSchema = z.object({
  model: z.string(),
  memory_gb: z.number().optional(),
  mlx: z.string().optional(),
  thinking: z.boolean().optional(),
});

export type ClaudeLiteSize = {
  name: string;
  model: string;
  memoryGb: number | null;
  mlx: string | null;
  hasThinkingByDefault: boolean;
};

export function resolveMlxUrl(env: Env = process.env): string {
  const port = env.CLAUDE_LITE_MLX_PORT?.trim() || DEFAULT_MLX_PORT;
  if (!/^\d{1,5}$/.test(port)) {
    throw new Error(`CLAUDE_LITE_MLX_PORT must be a port number, not ${port}`);
  }
  return `http://127.0.0.1:${port}`;
}

export const servedModelIdOf = (repository: string) => repository.replaceAll("/", "--");

export async function findClaudeLiteHome(env: Env): Promise<string | null> {
  if (env.CLAUDE_LITE_HOME) return env.CLAUDE_LITE_HOME;
  for (const directory of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const launcher = await realpath(path.join(directory, "cl")).catch(() => null);
    if (launcher) return path.dirname(path.dirname(launcher));
  }
  return null;
}

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function mergeSettings(base: JsonObject, overlay: JsonObject): JsonObject {
  const merged: JsonObject = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = merged[key];
    merged[key] =
      isJsonObject(existing) && isJsonObject(value) ? mergeSettings(existing, value) : value;
  }
  return merged;
}

export function loadClaudeLiteSizes(home: string): ClaudeLiteSize[] {
  const base = JSON.parse(readFileSync(path.join(home, "config", "sizes.json"), "utf8"));
  const overlayPath = path.join(home, "config", "local-sizes.json");
  const overlay = existsSync(overlayPath) ? JSON.parse(readFileSync(overlayPath, "utf8")) : {};
  const sizes = z.record(z.string(), SizeSchema).parse(mergeSettings(base, overlay));
  return Object.entries(sizes).map(([name, size]) => ({
    name,
    model: size.model,
    memoryGb: size.memory_gb ?? null,
    mlx: size.mlx ?? null,
    hasThinkingByDefault: size.thinking ?? false,
  }));
}

export function computeBudgetGb(memoryBytes: number, wiredLimitMb: number): number {
  return wiredLimitMb > 0 ? wiredLimitMb / 1024 : (memoryBytes / GIB) * METAL_BUDGET_FRACTION;
}

export function readWiredLimitMb(): number {
  if (process.platform !== "darwin") return 0;
  try {
    const output = execFileSync("/usr/sbin/sysctl", ["-n", "iogpu.wired_limit_mb"], {
      encoding: "utf8",
    });
    return Number.parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}
