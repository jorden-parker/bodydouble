import type { ModelStatus } from "@/lib/llm/model-status";

export type ModelChip = {
  name: string;
  place: string;
  state: "off" | "down" | "starting" | "failed" | "asleep" | "busy" | "ready";
  stateWord: string;
};

function nameOf(status: ModelStatus): { name: string; place: string } {
  if (status.backend === "claude-code")
    return { name: `Claude ${status.model ?? ""}`.trim(), place: "Anthropic" };
  return { name: status.size ?? status.model ?? "Model", place: "local" };
}

function stateOf(status: ModelStatus): ModelChip["state"] {
  if (!status.isEnabled) return "off";
  if (!status.isUsable && status.start.isStarting) return "starting";
  if (!status.isUsable) return status.start.failure === null ? "down" : "failed";
  if (
    status.lanes.running !== null ||
    status.lanes.queued.background + status.lanes.queued.interactive > 0
  )
    return "busy";
  if (status.backend === "local" && !status.isAwake) return "asleep";
  return "ready";
}

const STATE_WORDS: Record<ModelChip["state"], string> = {
  off: "off",
  down: "not running",
  starting: "starting",
  failed: "could not start",
  asleep: "asleep",
  busy: "busy",
  ready: "ready",
};

export function modelChipOf(status: ModelStatus | null): ModelChip | null {
  if (status === null) return null;
  const state = stateOf(status);
  return { ...nameOf(status), state, stateWord: STATE_WORDS[state] };
}
