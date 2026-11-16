import { describe, expect, it } from "vitest";
import { reviewPayload } from "@/test/review-fixture";
import { minutesLeft, stepsDone } from "./progress";

const review = { ...reviewPayload(), estimateMinutes: 12 };
const [TYPES, CLIENT, LOCK] = review.steps;

describe("stepsDone", () => {
  it("counts the steps that are ticked off", () => {
    expect(stepsDone(review, [TYPES.id, LOCK.id])).toBe(2);
    expect(stepsDone(review, [])).toBe(0);
  });
});

describe("minutesLeft", () => {
  it("shares the estimate out by the changed lines still to read", () => {
    expect(minutesLeft(review, [])).toBe(12);
    expect(minutesLeft(review, [CLIENT.id])).toBe(Math.round((12 * 2) / 4));
  });

  it("is zero once every step is done", () => {
    expect(
      minutesLeft(
        review,
        review.steps.map((step) => step.id),
      ),
    ).toBe(0);
  });
});
