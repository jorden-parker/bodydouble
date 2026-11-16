import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
import { savedLlmSettings } from "./llm-settings";
import { savedPreparationSetting } from "./preparation-settings";
import { savedRepositories } from "./repository-settings";
import { clearCacheResponse, settingsView, updateSettings } from "./settings-service";

const ENV = { PATH: "/nowhere", REVIEW_QUEUE_LLM_TIMEOUT_MS: "8000" };
const SETTINGS = {
  enabled: true,
  model: "b",
  thinking: "off",
  timeoutMs: 20_000,
  backend: "local",
  claudeModel: "haiku",
} as const;

function ollamaWith(names: string[]): typeof fetch {
  return (async () => Response.json({ models: names.map((name) => ({ name })) })) as typeof fetch;
}

const unreachable = (async () => {
  throw new Error("connection refused");
}) as typeof fetch;

describe("next-PR preparation", () => {
  it("is off until the reader switches it on, and the switch is saved", async () => {
    const store = new SessionStore(":memory:");
    expect((await settingsView(store, ENV, unreachable)).prepareNext).toBe(false);
    const saved = await updateSettings(store, { prepareNext: true }, ENV, unreachable);
    expect(await saved.json()).toMatchObject({ prepareNext: true });
    expect(savedPreparationSetting(store)).toBe(true);
  });
});

describe("settingsView", () => {
  it("shows the environment's settings and what the model choice found until settings are saved", async () => {
    const store = new SessionStore(":memory:");
    const view = await settingsView(store, ENV, ollamaWith(["a:latest", "b"]));
    expect(view.llm).toEqual({
      enabled: true,
      model: null,
      thinking: "model",
      timeoutMs: 8000,
      backend: "local",
      claudeModel: "haiku",
    });
    expect(view.choice).toMatchObject({ server: "ollama", served: ["a", "b"], isUsable: false });
    expect(view.repositories).toEqual([]);
  });

  it("still loads when Ollama is unreachable", async () => {
    const store = new SessionStore(":memory:");
    const view = await settingsView(store, ENV, unreachable);
    expect(view.choice).toMatchObject({ served: null, isUsable: false });
  });
});

describe("updateSettings", () => {
  it("saves valid settings and answers with the new view", async () => {
    const store = new SessionStore(":memory:");
    const response = await updateSettings(store, { llm: SETTINGS }, ENV, ollamaWith(["b"]));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ llm: SETTINGS, choice: { served: ["b"] } });
    expect(savedLlmSettings(store)).toEqual(SETTINGS);
  });

  it("rejects settings that do not fit the schema", async () => {
    const store = new SessionStore(":memory:");
    const body = { llm: { ...SETTINGS, timeoutMs: 5 } };
    const response = await updateSettings(store, body, ENV, ollamaWith([]));
    expect(response.status).toBe(400);
    expect(savedLlmSettings(store)).toBeNull();
  });

  it("saves the repositories and answers with them", async () => {
    const store = new SessionStore(":memory:");
    const response = await updateSettings(
      store,
      { repositories: ["acme/app"] },
      ENV,
      ollamaWith([]),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ repositories: ["acme/app"] });
    expect(savedRepositories(store)).toEqual(["acme/app"]);
    expect(savedLlmSettings(store)).toBeNull();
  });

  it("rejects repository names that are not owner/name", async () => {
    const store = new SessionStore(":memory:");
    const response = await updateSettings(store, { repositories: ["acme"] }, ENV, ollamaWith([]));
    expect(response.status).toBe(400);
    expect(savedRepositories(store)).toEqual([]);
  });
});

describe("clearCacheResponse", () => {
  it("empties the cache, keeps settings, and says how many entries it removed", async () => {
    const store = new SessionStore(":memory:");
    store.setCached("orientation:v4:acme/app#7:abc:m", "{}");
    store.setCached("etag:repos/acme/app/pulls/7", "{}");
    store.setSetting("llm", JSON.stringify(SETTINGS));
    const response = clearCacheResponse(store);
    expect(await response.json()).toEqual({ cleared: 2 });
    expect(store.getCached("orientation:v4:acme/app#7:abc:m")).toBeNull();
    expect(savedLlmSettings(store)).toEqual(SETTINGS);
  });
});
