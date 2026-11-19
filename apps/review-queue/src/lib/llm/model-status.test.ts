import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { startModel } from "./model-start";
import { buildModelStatus } from "./model-status";

const SAVED = {
  enabled: true,
  model: null,
  thinking: "model",
  timeoutMs: 8000,
  backend: "local",
  claudeModel: "haiku",
} as const;

const unreachable = (async () => {
  throw new Error("connection refused");
}) as typeof fetch;

function directoryWithOllama(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "model-status-"));
  writeFileSync(path.join(directory, "ollama"), "");
  return directory;
}

beforeEach(() => {
  delete (globalThis as { reviewQueueModelStart?: unknown }).reviewQueueModelStart;
});

describe("buildModelStatus", () => {
  it("names the command the app can run to start the model", async () => {
    const status = await buildModelStatus({ PATH: directoryWithOllama() }, unreachable, SAVED);
    expect(status.start).toEqual({ command: "ollama serve", isStarting: false, failure: null });
  });

  it("has nothing to start when the command would not work or is not needed", async () => {
    const missing = await buildModelStatus({ PATH: "/nowhere" }, unreachable, SAVED);
    const claude = await buildModelStatus({}, unreachable, { ...SAVED, backend: "claude-code" });
    expect([missing.start.command, claude.start.command]).toEqual([null, null]);
  });

  it("says the model is starting while the start command runs, then why it failed", async () => {
    const directory = directoryWithOllama();
    const child = new EventEmitter();
    startModel(["ollama", "serve"], path.join(directory, "server.log"), {}, () => child);
    const starting = await buildModelStatus({ PATH: directory }, unreachable, SAVED);
    child.emit("error", new Error("spawn ollama ENOENT"));
    const failed = await buildModelStatus({ PATH: directory }, unreachable, SAVED);
    expect(starting.start).toMatchObject({ isStarting: true, failure: null });
    expect(failed.start).toMatchObject({ isStarting: false, failure: "spawn ollama ENOENT" });
  });

  it("says why there is no model and what to start, and that the server does not answer", async () => {
    const status = await buildModelStatus({ PATH: "/nowhere" }, unreachable, SAVED);
    expect(status).toMatchObject({
      isEnabled: true,
      backend: "local",
      server: "ollama",
      model: null,
      isUsable: false,
      isServerAnswering: false,
      lanes: { running: null, queued: { interactive: 0, background: 0 } },
    });
    expect(status.reason).toContain("`cl serve");
    expect(status.speeds.reading.tokensPerSecond).toBeGreaterThan(0);
  });

  it("has no server or reason for Claude Code", async () => {
    const status = await buildModelStatus({}, unreachable, { ...SAVED, backend: "claude-code" });
    expect(status).toMatchObject({
      backend: "claude-code",
      server: null,
      model: "haiku",
      isUsable: true,
      reason: null,
      isServerAnswering: null,
    });
  });

  it("says the model is asleep until a turn has answered in the last five minutes", async () => {
    const status = await buildModelStatus({}, unreachable, SAVED);
    expect(status.isAwake).toBe(false);
  });

  it("names the Claude model from Settings, whichever backend is on", async () => {
    const status = await buildModelStatus({}, unreachable, { ...SAVED, claudeModel: "sonnet" });
    expect(status).toMatchObject({ backend: "local", claudeModel: "sonnet" });
  });

  it("reports nothing as usable when AI is off", async () => {
    const status = await buildModelStatus({}, unreachable, { ...SAVED, enabled: false });
    expect(status.isUsable).toBe(false);
  });
});
