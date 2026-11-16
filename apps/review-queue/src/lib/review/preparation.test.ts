import { describe, expect, it, vi } from "vitest";
import type { PullRequest } from "@/lib/github/gh";
import type { LlmConfig } from "@/lib/llm/client";
import { readLaneStatus, takeLane } from "@/lib/llm/lanes";
import { SessionStore } from "@/lib/session/store";
import { savePreparationSetting } from "@/lib/settings/preparation-settings";
import { modelReply } from "@/test/fake-llm";
import { storedOrientation } from "./orientation-service";
import { prepareReview, type PreparationDeps } from "./preparation";
import type { ReviewPayload } from "./prepare";

const REF = { owner: "a", repo: "b", number: 1 };
const PAYLOAD = {
  pr: { ref: REF, title: "T", body: "" } as PullRequest,
  headSha: "sha",
  files: [],
  steps: [],
  startStepId: null,
  hotspots: [],
  estimateMinutes: 1,
  changeMap: { nodes: [], edges: [], threads: [], orphanIds: [] },
} as unknown as ReviewPayload;
const CONFIG: LlmConfig = {
  baseURL: "http://llm.test",
  model: "m",
  enabled: true,
  backend: "local",
  thinking: true,
  timeoutMs: 60_000,
};
const REPLY = {
  summary: "S",
  intent: "I",
  risk: "low",
  stepOrder: [],
  hotspotNotes: [],
  extraHotspots: [],
};

function depsFor(store: SessionStore, fetchImpl: typeof fetch): PreparationDeps {
  return { store, config: CONFIG, load: vi.fn(async () => PAYLOAD), fetchImpl };
}

function hangingFetch() {
  let markCalled: () => void = () => undefined;
  const called = new Promise<void>((resolve) => (markCalled = resolve));
  const fetchImpl = ((_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      markCalled();
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
  return { fetchImpl, called };
}

describe("prepareReview", () => {
  it("does nothing while the next-PR preparation is switched off", async () => {
    const store = new SessionStore(":memory:");
    const deps = depsFor(store, vi.fn() as unknown as typeof fetch);
    expect(await prepareReview(REF, deps)).toBe("off");
    expect(deps.load).not.toHaveBeenCalled();
  });

  it("loads the review and keeps its orientation from a background model call", async () => {
    const store = new SessionStore(":memory:");
    savePreparationSetting(store, true);
    const fetchImpl = (async () => modelReply(JSON.stringify(REPLY))) as unknown as typeof fetch;
    expect(await prepareReview(REF, depsFor(store, fetchImpl))).toBe("prepared");
    expect(storedOrientation(PAYLOAD, store, CONFIG)).toMatchObject({ summary: "S" });
  });

  it("refuses a second preparation while one is running", async () => {
    const store = new SessionStore(":memory:");
    savePreparationSetting(store, true);
    const hanging = hangingFetch();
    const controller = new AbortController();
    const first = prepareReview(REF, depsFor(store, hanging.fetchImpl), controller.signal);
    await hanging.called;
    expect(await prepareReview(REF, depsFor(store, hanging.fetchImpl))).toBe("busy");
    controller.abort();
    await first;
  });

  it("hands the model lane to an interactive turn at once", async () => {
    const store = new SessionStore(":memory:");
    savePreparationSetting(store, true);
    const hanging = hangingFetch();
    const controller = new AbortController();
    const running = prepareReview(REF, depsFor(store, hanging.fetchImpl), controller.signal);
    await hanging.called;
    const turn = await takeLane("interactive");
    expect(readLaneStatus().running).toBe("interactive");
    turn.release();
    controller.abort();
    await running;
  });
});
