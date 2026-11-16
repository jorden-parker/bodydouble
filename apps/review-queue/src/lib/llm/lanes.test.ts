import { describe, expect, it } from "vitest";
import { readLaneStatus, takeLane, TurnPreempted } from "./lanes";

describe("takeLane", () => {
  it("runs an interactive turn before background turns that were queued earlier", async () => {
    const running = await takeLane("background");
    const order: string[] = [];
    const background = takeLane("background").then((turn) => {
      order.push("background");
      turn.release();
    });
    const interactive = takeLane("interactive").then((turn) => {
      order.push("interactive");
      turn.release();
    });
    expect(readLaneStatus()).toEqual({
      running: "background",
      queued: { interactive: 1, background: 1 },
    });
    running.release();
    await Promise.all([background, interactive]);
    expect(order).toEqual(["interactive", "background"]);
  });

  it("aborts a running background turn when an interactive turn arrives", async () => {
    const background = await takeLane("background");
    const interactive = takeLane("interactive");
    expect(background.signal.aborted).toBe(true);
    expect(background.signal.reason).toBeInstanceOf(TurnPreempted);
    background.release();
    (await interactive).release();
  });

  it("does not abort a running interactive turn for a background turn", async () => {
    const interactive = await takeLane("interactive");
    const background = takeLane("background");
    expect(interactive.signal.aborted).toBe(false);
    interactive.release();
    (await background).release();
  });

  it("lets a caller leave the queue without holding the next turn up", async () => {
    const running = await takeLane("interactive");
    const controller = new AbortController();
    const leaving = takeLane("background", controller.signal);
    const next = takeLane("background");
    controller.abort(new DOMException("left", "AbortError"));
    await expect(leaving).rejects.toThrow("left");
    running.release();
    (await next).release();
    expect(readLaneStatus()).toEqual({ running: null, queued: { interactive: 0, background: 0 } });
  });
});
