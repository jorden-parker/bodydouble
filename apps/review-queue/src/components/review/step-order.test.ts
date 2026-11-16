import { describe, expect, it } from "vitest";
import { reviewPayload } from "@/test/review-fixture";
import { orderedSteps, stepReasons, suggestedDifference, suggestedOrderIds } from "./step-order";
import type { OrientationState } from "./use-review";

const STEPS = reviewPayload().steps;
const [FIRST, SECOND, THIRD] = STEPS;

function ready(stepOrder: { id: string; why: string }[]): OrientationState {
  return {
    status: "ready",
    orientation: {
      model: "m",
      summary: "",
      intent: "",
      risk: "low",
      stepOrder,
      hotspotNotes: [],
      extraHotspots: [],
    },
  };
}

function readyWithOrder(ids: string[]): OrientationState {
  return ready(ids.map((id) => ({ id, why: `Read ${id} here.` })));
}

describe("orderedSteps", () => {
  it("keeps the built-in order when the reader has not chosen the model's", () => {
    expect(orderedSteps(STEPS, null)).toBe(STEPS);
  });

  it("uses the order the reader chose", () => {
    const order = [THIRD.id, FIRST.id, SECOND.id];
    expect(orderedSteps(STEPS, order)).toEqual([THIRD, FIRST, SECOND]);
  });

  it("keeps every step when the chosen order is incomplete or invented", () => {
    expect(orderedSteps(STEPS, ["nope", SECOND.id])).toEqual([SECOND, FIRST, THIRD]);
  });
});

describe("suggestedOrderIds", () => {
  it("reads the model's order only when it is ready", () => {
    expect(suggestedOrderIds(readyWithOrder([THIRD.id, FIRST.id]))).toEqual([THIRD.id, FIRST.id]);
    expect(suggestedOrderIds({ status: "loading" })).toBeNull();
    expect(suggestedOrderIds({ status: "error", message: "down" })).toBeNull();
  });
});

describe("suggestedDifference", () => {
  it("names the first step where the model would read something else", () => {
    const built = STEPS.map((step) => step.id);
    expect(suggestedDifference(built, [SECOND.id, FIRST.id, THIRD.id])).toEqual({
      suggested: SECOND.id,
      builtIn: FIRST.id,
    });
  });

  it("is null when the model agrees with the built-in order", () => {
    expect(
      suggestedDifference(
        STEPS.map((step) => step.id),
        STEPS.map((step) => step.id),
      ),
    ).toBeNull();
  });
});

describe("stepReasons", () => {
  it("maps each step to the model's reason for its place", () => {
    expect(stepReasons(readyWithOrder([SECOND.id]))).toEqual({
      [SECOND.id]: `Read ${SECOND.id} here.`,
    });
  });

  it("leaves out steps the model gave no reason for", () => {
    expect(stepReasons(ready([{ id: FIRST.id, why: "" }]))).toEqual({});
  });

  it("has no reasons until the model is ready", () => {
    expect(stepReasons({ status: "loading" })).toEqual({});
  });
});
