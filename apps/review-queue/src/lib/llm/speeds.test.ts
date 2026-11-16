import { afterEach, describe, expect, it, vi } from "vitest";
import { isModelAwake, readMeasuredSpeeds, startSpeedMeter } from "./speeds";

function clock(times: number[]) {
  const queue = [...times];
  return () => queue.shift() ?? 0;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readMeasuredSpeeds", () => {
  it("uses the defaults until a turn has been measured", () => {
    expect(readMeasuredSpeeds()).toEqual({
      reading: { tokensPerSecond: 170, isMeasured: false },
      writing: { tokensPerSecond: 13, isMeasured: false },
    });
  });
});

describe("startSpeedMeter", () => {
  it("measures reading from the processed tokens to the first block and writing from there to the end", () => {
    const meter = startSpeedMeter(340, false, clock([0, 2000, 4000]));
    meter.observe({ type: "content_block_start" });
    meter.observe({ type: "message_delta", usage: { output_tokens: 26 } });
    meter.observe({ type: "message_stop" });
    expect(readMeasuredSpeeds()).toEqual({
      reading: { tokensPerSecond: 170, isMeasured: true },
      writing: { tokensPerSecond: 13, isMeasured: true },
    });
  });

  it("does not learn reading speed from a cold start, whose wait includes loading the model", () => {
    const before = readMeasuredSpeeds().reading.tokensPerSecond;
    const meter = startSpeedMeter(1000, true, clock([0, 1000, 1000]));
    meter.observe({ type: "content_block_start" });
    meter.observe({ type: "message_stop" });
    expect(readMeasuredSpeeds().reading.tokensPerSecond).toBe(before);
  });

  it("keeps the model awake for five minutes after a turn finishes", () => {
    const finishedAt = Date.parse("2026-11-16T10:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(finishedAt);
    const meter = startSpeedMeter(100, false, clock([0, 1000, 2000]));
    meter.observe({ type: "content_block_start" });
    meter.observe({ type: "message_stop" });
    expect(isModelAwake(finishedAt + 4 * 60_000)).toBe(true);
    expect(isModelAwake(finishedAt + 6 * 60_000)).toBe(false);
  });
});
