import { describe, expect, it } from "vitest";
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

describe("buildModelStatus", () => {
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
