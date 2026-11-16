import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "@/lib/review/services";
import { savePreparationSetting } from "@/lib/settings/preparation-settings";

const orientation = { calls: 0 };

vi.mock("@/lib/review/prepare", () => ({
  loadReview: async () => ({}),
}));

vi.mock("@/lib/review/orientation-service", () => ({
  orientationFor: async () => {
    orientation.calls += 1;
  },
}));

process.env.REVIEW_QUEUE_DB = ":memory:";
process.env.REVIEW_QUEUE_LLM = "off";

const { POST } = await import("./route");

const globals = globalThis as { reviewQueuePreparing?: boolean };

function request(body: string) {
  return new Request("http://test/api/prepare", { method: "POST", body });
}

describe("POST prepare", () => {
  beforeEach(() => {
    orientation.calls = 0;
    globals.reviewQueuePreparing = false;
    savePreparationSetting(sessionStore(), true);
  });

  afterEach(() => {
    globals.reviewQueuePreparing = false;
  });

  it("answers off when preparing the next PR is switched off", async () => {
    savePreparationSetting(sessionStore(), false);
    const response = await POST(request(JSON.stringify({ key: "acme/app#7" })));
    expect(await response.json()).toEqual({ status: "off" });
    expect(orientation.calls).toBe(0);
  });

  it("answers busy while another preparation is running", async () => {
    globals.reviewQueuePreparing = true;
    const response = await POST(request(JSON.stringify({ key: "acme/app#7" })));
    expect(await response.json()).toEqual({ status: "busy" });
    expect(orientation.calls).toBe(0);
  });

  it("answers prepared after the orientation is built", async () => {
    const response = await POST(request(JSON.stringify({ key: "acme/app#7" })));
    expect(await response.json()).toEqual({ status: "prepared" });
    expect(orientation.calls).toBe(1);
  });

  it("rejects a body without a valid pull request key", async () => {
    expect((await POST(request(JSON.stringify({ key: "nope" })))).status).toBe(400);
    expect((await POST(request("{nope"))).status).toBe(400);
    expect(orientation.calls).toBe(0);
  });
});
