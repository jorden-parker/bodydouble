import type { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
import { spawnDetached } from "@/lib/exec";

type ModelStart = { isRunning: boolean; failure: string | null };
type Launch = (
  command: string,
  args: string[],
  options: { logPath: string; env: Record<string, string> },
) => EventEmitter;

const SERVER_VARIABLE = /^(OLLAMA_|CLAUDE_LITE_|HF_)/;
const FAILURE_LENGTH = 300;
const STATUS_READS = 10;
const globals = globalThis as { reviewQueueModelStart?: ModelStart };

function serverVariables(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([name, value]) =>
      SERVER_VARIABLE.test(name) && value !== undefined ? [[name, value]] : [],
    ),
  );
}

function lastLineOf(logPath: string): string | null {
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  return lines.at(-1)?.trim().slice(0, FAILURE_LENGTH) || null;
}

export function startModel(
  startCommand: string[],
  logPath: string,
  env: Record<string, string | undefined> = process.env,
  launch: Launch = spawnDetached,
): void {
  if (globals.reviewQueueModelStart?.isRunning) return;
  const [command, ...args] = startCommand;
  const child = launch(command, args, { logPath, env: serverVariables(env) });
  const start: ModelStart = { isRunning: true, failure: null };
  globals.reviewQueueModelStart = start;
  child.on("error", (error: Error) => {
    start.isRunning = false;
    start.failure = error.message;
  });
  child.on("exit", (exitCode: number | null) => {
    start.isRunning = false;
    if (exitCode === 0) return;
    start.failure = lastLineOf(logPath) ?? `${startCommand.join(" ")} exited with code ${exitCode}`;
  });
}

export function readModelStart(): ModelStart {
  const start = globals.reviewQueueModelStart;
  return { isRunning: start?.isRunning ?? false, failure: start?.failure ?? null };
}

export async function waitWhileStarting<Status extends { start: { isStarting: boolean } }>(
  readStatus: () => Promise<Status>,
  pauseMs = 500,
): Promise<Status> {
  let status = await readStatus();
  for (let i = 1; i < STATUS_READS && status.start.isStarting; i += 1) {
    await pause(pauseMs);
    status = await readStatus();
  }
  return status;
}
