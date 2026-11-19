import { describe, expect, it } from "vitest";
import type { ModelStatus } from "@/lib/llm/model-status";
import { modelChipOf } from "./model-chip";

const LOCAL: ModelStatus = {
  isEnabled: true,
  backend: "local",
  server: "ollama",
  model: "qwen3.5-9b",
  size: "9B",
  isUsable: true,
  reason: null,
  isServerAnswering: true,
  isAwake: true,
  claudeModel: "haiku",
  lanes: { running: null, queued: { interactive: 0, background: 0 } },
  speeds: {
    reading: { tokensPerSecond: 170, isMeasured: false },
    writing: { tokensPerSecond: 13, isMeasured: false },
  },
  start: { command: null, isStarting: false, failure: null },
};

describe("modelChipOf", () => {
  it("shows nothing until the status has loaded", () => {
    expect(modelChipOf(null)).toBeNull();
  });

  it("names a local model and says it is ready", () => {
    expect(modelChipOf(LOCAL)).toEqual({
      name: "9B",
      place: "local",
      state: "ready",
      stateWord: "ready",
    });
  });

  it("says a model that has not answered for five minutes is asleep", () => {
    expect(modelChipOf({ ...LOCAL, isAwake: false })).toMatchObject({
      state: "asleep",
      stateWord: "asleep",
    });
  });

  it("says a model with turns running or queued is busy", () => {
    expect(
      modelChipOf({
        ...LOCAL,
        lanes: { running: "interactive", queued: { interactive: 0, background: 2 } },
      }),
    ).toMatchObject({ state: "busy", stateWord: "busy" });
  });

  it("says a model that cannot be used is not running", () => {
    expect(modelChipOf({ ...LOCAL, isUsable: false, reason: "Start one" })).toMatchObject({
      state: "down",
      stateWord: "not running",
    });
  });

  it("says a model the app is starting is starting", () => {
    const start = { command: "ollama serve", isStarting: true, failure: null };
    expect(modelChipOf({ ...LOCAL, isUsable: false, start })).toMatchObject({
      state: "starting",
      stateWord: "starting",
    });
  });

  it("says a model whose start command failed could not start", () => {
    const start = { command: "ollama serve", isStarting: false, failure: "address in use" };
    expect(modelChipOf({ ...LOCAL, isUsable: false, start })).toMatchObject({
      state: "failed",
      stateWord: "could not start",
    });
  });

  it("says the model is off when AI is switched off", () => {
    expect(modelChipOf({ ...LOCAL, isEnabled: false, isUsable: false })).toMatchObject({
      state: "off",
      stateWord: "off",
    });
  });

  it("names the Claude model for the Claude Code backend", () => {
    expect(
      modelChipOf({ ...LOCAL, backend: "claude-code", server: null, model: "haiku", size: null }),
    ).toEqual({ name: "Claude haiku", place: "Anthropic", state: "ready", stateWord: "ready" });
  });
});
