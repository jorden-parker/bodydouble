import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readModelStart, startModel, waitWhileStarting } from "./model-start";

const logPath = path.join(mkdtempSync(path.join(tmpdir(), "model-start-")), "model-server.log");

function fakeLaunch() {
  const child = new EventEmitter();
  return { child, launch: vi.fn(() => child) };
}

beforeEach(() => {
  delete (globalThis as { reviewQueueModelStart?: unknown }).reviewQueueModelStart;
  writeFileSync(logPath, "");
});

describe("startModel", () => {
  it("launches the command once, with only the model server's variables", () => {
    const { launch } = fakeLaunch();
    const env = { OLLAMA_KEEP_ALIVE: "30m", CLAUDE_LITE_MLX_PORT: "8435", GH_TOKEN: "secret" };
    startModel(["cl", "serve", "9b"], logPath, env, launch);
    startModel(["cl", "serve", "9b"], logPath, env, launch);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith("cl", ["serve", "9b"], {
      logPath,
      env: { OLLAMA_KEEP_ALIVE: "30m", CLAUDE_LITE_MLX_PORT: "8435" },
    });
    expect(readModelStart()).toEqual({ isRunning: true, failure: null });
  });

  it("reports the last line the command printed when it exits with an error", () => {
    const { child, launch } = fakeLaunch();
    startModel(["ollama", "serve"], logPath, {}, launch);
    writeFileSync(logPath, "starting\nError: address already in use\n\n");
    child.emit("exit", 1);
    expect(readModelStart()).toEqual({
      isRunning: false,
      failure: "Error: address already in use",
    });
  });

  it("names the command and its exit code when it printed nothing", () => {
    const { child, launch } = fakeLaunch();
    startModel(["ollama", "serve"], logPath, {}, launch);
    child.emit("exit", 2);
    expect(readModelStart().failure).toBe("ollama serve exited with code 2");
  });

  it("reports a command that could not be launched", () => {
    const { child, launch } = fakeLaunch();
    startModel(["ollama", "serve"], logPath, {}, launch);
    child.emit("error", new Error("spawn ollama ENOENT"));
    expect(readModelStart()).toEqual({ isRunning: false, failure: "spawn ollama ENOENT" });
  });

  it("can start again after the command has ended, and forgets the old failure", () => {
    const first = fakeLaunch();
    startModel(["ollama", "serve"], logPath, {}, first.launch);
    first.child.emit("exit", 0);
    expect(readModelStart()).toEqual({ isRunning: false, failure: null });
    const second = fakeLaunch();
    startModel(["ollama", "serve"], logPath, {}, second.launch);
    expect(second.launch).toHaveBeenCalledTimes(1);
  });
});

describe("waitWhileStarting", () => {
  it("reads the status again until the model is no longer starting", async () => {
    const statuses = [true, true, false].map((isStarting) => ({ start: { isStarting } }));
    const readStatus = vi.fn(async () => statuses.shift()!);
    expect(await waitWhileStarting(readStatus, 0)).toEqual({ start: { isStarting: false } });
    expect(readStatus).toHaveBeenCalledTimes(3);
  });

  it("gives up after ten reads and returns the status as it is", async () => {
    const readStatus = vi.fn(async () => ({ start: { isStarting: true } }));
    expect(await waitWhileStarting(readStatus, 0)).toEqual({ start: { isStarting: true } });
    expect(readStatus).toHaveBeenCalledTimes(10);
  });
});
